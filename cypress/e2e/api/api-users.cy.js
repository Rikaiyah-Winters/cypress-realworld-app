import { faker } from "@faker-js/faker";
const apiUsers = `${Cypress.env("apiUrl")}/users`;

describe("Users API", () => {
    let ctx = {};

    before(() => {
        cy.request("GET", "/");
    });

    beforeEach(() => {
        cy.task("db:seed");

        cy.database("filter", "users").then((users) => {
            ctx.authenticatedUser = users[0];
            ctx.searchUser = users[1];

            return cy.loginByApi(ctx.authenticatedUser.username);
        });
    });

    context("GET /users", () => {
        it("gets a list of users", () => {
            cy.request("GET", apiUsers).then((response) => {
                const resp = response.body.results;
                expect(response.status).to.eq(200);
                expect(resp).length.to.be.greaterThan(1);
                expect(resp.length).to.eq(4);
                //make a loop to see that none of their id's match ted's
                resp.forEach((user) => {
                    expect(user.id).to.not.eq(ctx.authenticatedUser.id)
                    expect(user.username).to.be.a("string");
                    expect(user.balance).to.be.greaterThan(0);
                });
            });
        });
    });

    context("GET /users/:userId", () => {
        it("gets a user", () => {
            cy.request("GET", `${apiUsers}/${ctx.authenticatedUser.id}`).then((response) => {
                const resp = response.body.user;
                expect(response.status).to.eq(200);
                expect(resp).to.have.property("firstName");
                expect(resp.username).to.eq(ctx.authenticatedUser.username);
                expect(resp).to.have.property("email");
                expect(resp.id).to.be.a("string");
            });
        });

        it("errors when invalid userId", () => {
            cy.request({
                method: "GET",
                url: `${apiUsers}/1234`,
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.eq(422);
                expect(response.body.errors.length).to.eq(1);
                cy.log(`${response.body.errors[0].msg} for ${response.body.errors[0].param}`);
            });
        });
    });

    context("GET /users/profile/:username", () => {
        it("gets a user profile by username", () => {
            const { username, firstName, lastName, avatar } = ctx.authenticatedUser;
            cy.request("GET", `${apiUsers}/profile/${username}`).then((response) => {
                const resp = response.body.user;

                expect(response.status).to.eq(200)
                expect(resp).to.deep.equal({
                    firstName: firstName,
                    lastName: lastName,
                    avatar: avatar,
                });
                expect(resp).not.to.have.any.keys("username", "email", "phoneNumber");
            });
        });
    });

    context("GET /users/search", () => {
        it("gets users by email", () => {
            const { email, firstName } = ctx.searchUser;
            cy.request({
                method: "GET",
                url: `${apiUsers}/search`,
                qs: { q: email },
            }).then((response) => {
                const resp = response.body.results[0];

                expect(response.status).to.eq(200);
                expect(response.body.results.length).to.eq(1);
                expect(resp).to.contain({
                    firstName: firstName,
                });
                expect(resp.id).to.eq(ctx.searchUser.id);
                expect(resp.lastName).to.eq(ctx.searchUser.lastName);
                expect(resp.username).to.eq(ctx.searchUser.username);
            });
        });

        it("gets users by phone number", () => {
            const { phoneNumber, firstName } = ctx.searchUser;

            cy.request({
                method: "GET",
                url: `${apiUsers}/search`,
                qs: { q: phoneNumber },
            }).then((response) => {
                const resp = response.body.results[0];

                expect(response.status).to.eq(200);
                expect(response.body.results.length).to.eq(1);
                expect(resp).to.contain({
                    firstName,
                });
                expect(resp.id).to.eq(ctx.searchUser.id);
                expect(resp.lastName).to.eq(ctx.searchUser.lastName);
                expect(resp.username).to.eq(ctx.searchUser.username);
            });
        });

        it("gets users by username", () => {
            const { username, firstName } = ctx.searchUser;

            cy.request({
                method: "GET",
                url: `${apiUsers}/search`,
                qs: { q: username },
            }).then((response) => {
                const resp = response.body.results[0];
                expect(response.status).to.eq(200);
                expect(response.body.results.length).to.eq(1);
                expect(resp).to.contain({
                    firstName,
                });
                cy.log(resp);
                expect(resp.id).to.eq(ctx.searchUser.id);
                expect(resp.lastName).to.eq(ctx.searchUser.lastName);
                expect(resp.email).to.eq(ctx.searchUser.email);

            });
        });
    });

    context("POST /users", () => {
        it("creates a new user", () => {
            const firstName = faker.name.firstName();

            cy.request("POST", `${apiUsers}`, {
                firstName,
                lastName: faker.name.lastName(),
                username: faker.internet.userName(),
                password: faker.internet.password(),
                email: faker.internet.email(),
                phoneNumber: faker.phone.phoneNumber(),
                avatar: faker.internet.avatar(),
            }).then((response) => {
                const resp = response.body.user;
                expect(response.status).to.eq(201);
                expect(resp).to.contain({ firstName });
                expect(resp).to.have.property("username");
                expect(resp).to.have.property("email");
                expect(resp).to.have.property("id");
            });
        });

        it("creates a new user with an account balance in cents", () => {
            const firstName = faker.name.firstName();

            cy.request("POST", `${apiUsers}`, {
                firstName,
                lastName: faker.name.lastName(),
                username: faker.internet.userName(),
                password: faker.internet.password(),
                email: faker.internet.email(),
                phoneNumber: faker.phone.phoneNumber(),
                avatar: faker.internet.avatar(),
                balance: 399.89,
            }).then((response) => {
                const resp = response.body.user;

                expect(response.status).to.eq(201);
                expect(resp).to.contain({ firstName });
                expect(resp.balance).to.equal(399.89);
            });
        });

        it("errors when an invalid field sent", () => {
            cy.request({
                method: "POST",
                url: `${apiUsers}`,
                failOnStatusCode: false,
                body: {
                    notAUserField: "not a user field",
                },
            }).then((response) => {
                expect(response.status).to.eq(422);
                expect(response.body.errors.length).to.eq(1);
                cy.log(response.body.errors[0].msg);
            });
        });
    });


    context("PATCH /users/:userId", () => {
        it("updates a user", () => {
            const firstName = faker.name.firstName();

            cy.request("PATCH", `${apiUsers}/${ctx.authenticatedUser.id}`, {
                firstName,
            }).then((response) => {
                expect(response.status).to.eq(204);
                expect(response.body).to.deep.eq(undefined);
            });
        });

        it("errors when an invalid field sent", () => {
            cy.request({
                method: "PATCH",
                url: `${apiUsers}/${ctx.authenticatedUser.id}`,
                failOnStatusCode: false,
                body: {
                    notAUserField: "not a user field",
                },
            }).then((response) => {
                expect(response.status).to.eq(422);
                expect(response.body.errors.length).to.eq(1);
                cy.log(response.body.errors[0].msg);
                cy.log(response.statusText);
                expect(response.isOkStatusCode).to.be.false;
            });
        });
    });

    context("POST /login", () => {
        it("logs in as a user", () => {
            cy.loginByApi(ctx.authenticatedUser.username).then((response) => {
                const resp = response.body.user;

                expect(response.status).to.eq(200);
                expect(resp.username).to.eq(ctx.authenticatedUser.username);
                expect(resp.id).to.eq(ctx.authenticatedUser.id);
                expect(response.isOkStatusCode).to.be.true;
            });
        });
    });
});