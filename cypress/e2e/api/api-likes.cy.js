const apiLikes = `${Cypress.env("apiUrl")}/likes`;

describe("Likes API", () => {
    let ctx = {};

    before(() => {
        cy.request("GET", "/");
    });

    beforeEach(() => {
        cy.task("db:seed");

        cy.database("filter", "users").then((users) => {
            ctx.authenticatedUser = users[0];
            return cy.loginByApi(ctx.authenticatedUser.username);
        });

        cy.database("find", "likes").then((like) => {
            ctx.transactionId = like.transactionId;
        });
    });

    context("Retrieve /likes/:transactionId", () => {
        it("gets a list of likes for a transaction", () => {
            cy.request("GET", `${apiLikes}/${ctx.transactionId}`).then((response) => {
                const resp = response.body.likes;
                expect(response.status).to.eq(200);
                expect(resp.length).to.eq(1);
                expect(resp[0].userId).to.eq(ctx.authenticatedUser.id);
            });
        });
    });

    context("POST /likes/:transactionId", () => {
        it("creates a new like for a transaction", () => {
            cy.request("POST", `${apiLikes}/${ctx.transactionId}`, {
                transacitonId: ctx.transacitonId,
            }).then((response) => {
                expect(response.status).to.eq(200);
            })
        })
    })
})