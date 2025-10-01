const apiBankTransfer = `${Cypress.env("apiUrl")}/bankTransfers`;

describe("Bank Transfer API", () => {
    const ctx = {};

    before(() => {
        cy.request("GET", "/");
    });

    beforeEach(() => {
        cy.task("db:seed");

        cy.database("find", "users").then((user) => {
            ctx.authenticatedUser = user;
            return cy.loginByApi(ctx.authenticatedUser.username);
        });

        cy.database("find", "bankaccounts").then((acc) => {
            ctx.authenticatedUserAcc = acc.id;
        })
    });

    context("GET /bankTransfer", () => {
        it("gets a list of bank transfers for user", () => {
            const { id: userId } = ctx.authenticatedUser;

            cy.request("GET", `${apiBankTransfer}`).then((response) => {
                const resp = response.body.transfers;
                
                expect(response.status).to.eq(200);
                resp.forEach((transfer) => {
                    expect(transfer.userId).to.eq(userId);
                    expect(transfer.source).to.eq(ctx.authenticatedUserAcc);
                    expect(transfer.type).to.be.oneOf(["deposit", "withdrawal"]);
                })
            });
        });
    });
});