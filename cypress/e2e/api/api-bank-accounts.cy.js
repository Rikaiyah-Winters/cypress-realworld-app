import { faker } from "@faker-js/faker";

const apiBankAccounts = `${Cypress.env("apiUrl")}/bankAccounts`;
const apiGraphQL = `${Cypress.env("apiUrl")}/graphql`;

describe("Bank Accounts API", () => {
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

        cy.database("filter", "bankaccounts").then((accounts) => {
            ctx.bankAccounts = accounts;
        });
    });

    context("GET /bankAccounts", () => {
        it("gets a list of bank accounts for user", () => {
            const { id: userId } = ctx.authenticatedUser;
            const { id, bankName } = ctx.bankAccounts[0];

            cy.request("GET", `${apiBankAccounts}`).then((response) => {
                const resp = response.body.results[0];

                expect(response.status).to.eq(200);
                expect(response.body.results).to.have.length(1);
                expect(resp.userId).to.eq(userId);
                expect(resp.id).to.eq(id);
                expect(resp.bankName).to.eq(bankName);
            });
        });
    });

    context("GET /bankAccounts/:bankAccountId", () => {
        it("retrieves one specific bank account by bank account id", () => {
            const { id: userId } = ctx.authenticatedUser;
            const { id, bankName, accountNumber, routingNumber } = ctx.bankAccounts[0];

            cy.request("GET", `${apiBankAccounts}/${id}`).then((response) => {
                const resp = response.body.account;

                expect(response.status).to.eq(200);
                expect(resp.userId).to.eq(userId);
                expect(resp.bankName).to.eq(bankName);
                expect(resp.accountNumber).to.eq(accountNumber);
                expect(resp.routingNumber).to.eq(routingNumber);
            });
        });
    });

    context("POST /bankAccounts", () => {
        it("creates a new bank account", () => {
            const { id: userId } = ctx.authenticatedUser;
            const newBank = faker.company.companyName();
            const newAcc = faker.finance.account(10);
            const newRoute = faker.finance.account(9);

            cy.request("POST", `${apiBankAccounts}`, {
                bankName: `${newBank} Bank`,
                accountNumber: newAcc,
                routingNumber: newRoute,
            }).then((response) => {
                const resp = response.body.account;

                expect(response.status).to.eq(200);
                expect(resp.id).to.be.a("string");
                expect(resp.userId).to.eq(userId);
                expect(resp.bankName).to.eq(`${newBank} Bank`);
                expect(resp.accountNumber).to.eq(newAcc);
                expect(resp.routingNumber).to.eq(newRoute);

            });
        });
    });

    context("DELETE /contacts/:bankAccountId", () => {
        it("deletes a bank account", () => {
            const { id: bankAccountId } = ctx.bankAccounts[0];
            cy.request("DELETE", `${apiBankAccounts}/${bankAccountId}`).then((response) => {
                expect(response.status).to.eq(200);
                expect(response.body).to.deep.eq({})
            });
        });
    });

    context("/graphql", () => {
        it("gets a list of bank accounts for user via graphql", () => {
            const { id: userId } = ctx.authenticatedUser;
            cy.request("POST", `${apiGraphQL}`, {
                query: `query {
                listBankAccount {
                id
                uuid
                userId
                bankName
                accountNumber
                routingNumber
                isDeleted
                createdAt
                modifiedAt
            }
          }`,
            }).then((response) => {
                const resp = response.body.data.listBankAccount[0];

                expect(response.status).to.eq(200);
                expect(resp.userId).to.eq(userId);
                expect(resp.bankName).to.eq("Waters, King and O'Reilly Bank");
                expect(response.body.data.listBankAccount.length).to.eq(1);
            });
        });

        it("creates a new bank account via graphql", () => {
            const { id: userId } = ctx.authenticatedUser;

            const newBank = faker.company.companyName();
            const newAcc = faker.finance.account(10);
            const newRoute = faker.finance.account(9);

            cy.request("POST", `${apiGraphQL}`, {
                query: `mutation createBankAccount ($bankName: String!, $accountNumber: String!,  $routingNumber: String!) {
                    createBankAccount(
                        bankName: $bankName,
                        accountNumber: $accountNumber,
                        routingNumber: $routingNumber
                    ) {
                        id
                        uuid
                        userId
                        bankName
                        accountNumber
                        routingNumber
                        isDeleted
                        createdAt
                    }
                }`,
                variables: {
                    bankName: `${newBank} Bank`,
                    accountNumber: newAcc,
                    routingNumber: newRoute,
                },
            }).then((response) => {
                const resp = response.body.data.createBankAccount;

                expect(response.status).to.eq(200);
                expect(resp.userId).to.eq(userId);
                expect(resp.bankName).to.eq(`${newBank} Bank`);
                expect(resp.accountNumber).to.eq(newAcc);
                expect(resp.routingNumber).to.eq(newRoute);
            });
        });

        it("deletes a bank account via graphql", () => {
            const { id: bankAccountId } = ctx.bankAccounts[0];

            cy.request("POST", `${apiGraphQL}`, {
                query: `mutation deleteBankAccount ($id: ID!) {
                    deleteBankAccount(id: $id)
                }`,
                variables: { id: bankAccountId },
            }).then((response) => {
                expect(response.status).to.eq(200);
                expect(response.body.data.deleteBankAccount).to.be.true;
            });
        });
    });
});