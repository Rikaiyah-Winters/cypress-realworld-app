const apiTestData = `${Cypress.env("apiUrl")}/testData`;

describe("Test Data API", () => {
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
    });

    context("Test that the Data for each given entitiy is able to be retrieved", () => {
        const entities = ["users", "contacts", "bankaccounts", "notifications", "transactions", "likes", "comments", "banktransfers"];

        Cypress._.each(entities, (entity) => {
            it(`retrieves api mock data for ${entity}`, () => {
                cy.request("GET", `${apiTestData}/${entity}`).then((response) => {
                    expect(response.status).to.eq(200);
                    expect(response.body.results.length).to.be.greaterThan(1);
                });
            });
        });
    });
});