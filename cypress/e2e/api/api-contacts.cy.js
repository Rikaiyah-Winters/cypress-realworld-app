const apiContacts = `${Cypress.env("apiUrl")}/contacts`;

describe("Contacts API", () => {
    let ctx = {};

    before(() => {
        cy.request("GET", "/");
    });

    beforeEach(() => {
        cy.task("db:seed");

        cy.database("filter", "users").then((users) => {
            ctx.authenticatedUser = users[0];
            ctx.allUsers = users;

            return cy.loginByApi(ctx.authenticatedUser.username);
        });

        cy.database("find", "contacts").then((contact) => {
            ctx.contact = contact;
        });
    })

    context("GET /contacts/:username", () => {
        it("gets a list of contacts by username", () => {
            const { username } = ctx.authenticatedUser;

            cy.request("GET", `${apiContacts}/${username}`).then((response) => {
                const resp = response.body.contacts;

                expect(response.status).to.eq(200);
                expect(resp[0].userId).to.eq(ctx.authenticatedUser.id);
                expect(resp[0]).to.have.property("id");
                expect(resp).to.be.an("array").has.length(3);
            });
        });
    });

    context("POST /contacts", () => {
        it("creates a new contact", () => {
            const { id: userId } = ctx.authenticatedUser;
            cy.request("POST", `${apiContacts}`, {
                contactUserId: ctx.contact.id,
            }).then((response) => {
                expect(response.status).to.eq(200);
                expect(response.body.contact.userId).to.eq(userId);
                expect(response.body.contact.contactUserId).to.eq(ctx.contact.id);
            });
        });

        it("errors when in valid contactUserId", () => {
            cy.request({
                method: "POST",
                url: `${apiContacts}`,
                failOnStatusCode: false,
                body: {
                    contactUserId: "1234",
                },
            }).then((response) => {
                expect(response.status).to.eq(422);
                expect(response.body.errors).to.be.an("array").that.has.length(1);
                cy.log(response.body.errors[0].msg)
            });
        });
    });

    context("DELETE /contact/:contactId", () => {
        it("deletes a contact", () => {
            cy.request("DELETE", `${apiContacts}/${ctx.contact.id}`).then((response) => {
                expect(response.status).to.eq(200);
                expect(response.body).to.deep.eq({});
            });
        });
    });
});