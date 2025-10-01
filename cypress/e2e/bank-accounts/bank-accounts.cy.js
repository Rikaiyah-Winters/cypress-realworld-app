const apiGraphQL = `${Cypress.env("apiUrl")}/graphql`;
const ctx = {};

describe("Bank Account functions", () => {
    beforeEach(() => {
        cy.task("db:seed");
        cy.intercept("GET", "/notifications").as("getNotifications");
        cy.intercept("POST", apiGraphQL, (req) => {
            const operationAliases = {
                ListBankAccount: "gqlListBankAccountQuery",
                CreateBankAccount: "gqlCreateBankAccountMutation",
                DeleteBankAccount: "gqlDeleteBankAccountMutation",
            };
            const operationName = req.body && req.body.operationName;
            if (operationAliases.hasOwnProperty(operationName)) {
                req.alias = operationAliases[operationName]
            };
        });
        cy.database("find", "users", { username: "Judah_Dietrich50" }).then((user) => {
            ctx.user = user;
            return cy.loginByXstate(ctx.user.username);
        });
        cy.dt("sidenav-bankaccounts").click();
    });

    it("Add a new Bank Account", () => {
        cy.wait("@gqlListBankAccountQuery");
        cy.dt("bankaccount-new").click();
        cy.dtl("form").should("be.visible");
        cy.dtl("bankName-input").type("Bank Kname Credit Union");
        cy.dtl("routingNumber-input").type("240382390");
        cy.dtl("accountNumber-input").type("968324489");
        cy.dtl("submit").click();
        cy.dtl("list-item").should("have.length", 2).eq(1).should("contain", "Bank Kname Credit Union");
    });

    it("Delete a Bank Account", () => {
        const bankName = "Schaden - Halvorson Bank";
        cy.dtl("bankaccount-list-item").last().find("button").click();
        cy.wait("@gqlDeleteBankAccountMutation");
        cy.dtl("bankaccount-list-item").last().should("have.text", `${bankName} (Deleted)`);
    });

    it("Displays individual new bank account form errors", () => {
        cy.dt("bankaccount-new").click();
        cy.dtl("form").should("be.visible");

        //bank name
        cy.dtl("bankName-input").type("a");
        cy.dtl("bankName-input").find("input").blur();
        cy.dtl("bankName-input").find("input").clear();
        cy.get("#bankaccount-bankName-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter a bank name");

        cy.dtl("bankName-input").type("a");
        cy.get("#bankaccount-bankName-input-helper-text")
        .should("be.visible")
        .and("have.text", "Must contain at least 5 characters");

        //routing number
        //too few digits
        cy.dtl("routingNumber-input").type("1"); 
        cy.get("#bankaccount-routingNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Must contain a valid routing number");

        //too many digits
        cy.dtl("routingNumber-input").type("1234567890"); 
        cy.get("#bankaccount-routingNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Must contain a valid routing number");

        //no digits
        cy.dtl("routingNumber-input").find("input").clear();
        cy.dtl("routingNumber-input").find("input").blur();
        cy.get("#bankaccount-routingNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter a valid bank routing number");

        //account number
        //too few digits
        cy.dtl("accountNumber-input").type("1");
        cy.get("#bankaccount-accountNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Must contain at least 9 digits");

        //too many digits
        cy.dtl("accountNumber-input").type("1234567890123");
        cy.get("#bankaccount-accountNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Must contain no more than 12 digits");

        //no digits
        cy.dtl("accountNumber-input").find("input").clear();
        cy.dtl("accountNumber-input").find("input").blur();
        cy.get("#bankaccount-accountNumber-input-helper-text")
        .should("be.visible")
        .and("have.text", "Enter a valid bank account number");

        cy.dtl("submit").should("be.disabled");
    });

    it("UI shows empty bank list when backend is intercepted with []", () => {
        cy.wait("@getNotifications");
        cy.intercept("POST", apiGraphQL, (req) => {
            const { body } = req;
            if (body.hasOwnProperty("operationName") && body.operationName === "ListBankAccount") {
                req.alias = "gqlListBankAccountQuery";
                req.continue((res) => {
                    res.body.data.listBankAccount = [];
                });
            }
        });

        cy.visit("/bankaccounts");
        cy.wait("@getNotifications");
        cy.wait("@gqlListBankAccountQuery");

        cy.dt("bankaccount-list").should("not.exist");
        cy.dt("empty-list-header").should("contain", "No Bank Accounts");
        cy.dt("user-onboarding-dialog").should("be.visible");
    });
});