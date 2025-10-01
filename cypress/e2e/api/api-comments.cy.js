const apiComments = `${Cypress.env("apiUrl")}/comments`;

describe("Comments API", () => {
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

        cy.database("find", "comments").then((comment) => {
            ctx.transactionId = comment.transactionId;
        });
    });

    context("GET /comments/:transactionId", () => {
        it("gets a list of comments for a transaciton", () => {
            const transactionId = ctx.transactionId;
            cy.request("GET", `${apiComments}/${transactionId}`).then((response) => {
                const resp = response.body.comments;
                expect(response.status).to.eq(200);
                expect(resp).to.be.an("array").has.length(1);
                expect(resp[0].content).to.eq("rerum enim corporis");
                expect(resp[0].userId).to.eq(ctx.authenticatedUser.id);
            });
        });
    });

    context("POST /comments/:transactionId", () => {
        it("creates a new comment for a transaction", () => {
            const transactionId = ctx.transactionId;
            cy.request("POST", `${apiComments}/${transactionId}`, {
                content: "September Rent 🤑🫰💰💹🥶🛖",
            }).then((response) => {
                expect(response.status).to.eq(200);
            });
        });
    });
});