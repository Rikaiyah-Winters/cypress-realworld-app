import Dinero from "dinero.js";
const ctx = {};
//might put ctx inside 'describe'


describe("New Transaction", () => {
    beforeEach(() => {
        cy.task("db:seed");
        cy.intercept("GET", "/users*").as("allUsers");
        cy.intercept("GET", "/users/search*").as("usersSearch");
        cy.intercept("POST", "/transactions").as("createTransaction");
        cy.intercept("GET", "/notifications").as("notifications");
        cy.intercept("GET", "/transactions/public").as("publicTransactions");
        cy.intercept("GET", "/transactions").as("personalTransactions");
        cy.intercept("PATCH", "/transactions/*").as("updateTransaction");

        cy.database("filter", "users").then((users) => {
            ctx.allUsers = users;
            ctx.user = users[3];
            ctx.contact = users[4];
            return cy.loginByXstate(ctx.user.username);
        });

        cy.dt("nav-top-new-transaction").click();
    });

    it("Completes a payment transaction", () => {
        const payment = {
            amount: "75",
            note: "New toothbrush and toothpaste 🦷🪥"
        };

        cy.wait("@allUsers");
        cy.dtl("search-input").type(ctx.contact.username);
        cy.dtl("user-list-item").contains(ctx.contact.username).click();
        cy.dtl("amount-input").type(payment.amount);
        cy.dtl("description-input").type(payment.note);
        cy.dtl("submit-payment").click();
        cy.get("h2").contains(ctx.contact.firstName).should("be.visible");

        const formattedPayment = Dinero({
            amount: parseInt(payment.amount) * 100,
        }).toFormat();

        cy.get("h2").then((h2) => {
            const confirmationNote = h2[1].innerText;
            expect(confirmationNote).to.eq(`Paid ${formattedPayment} for ${payment.note}`);
        });

        cy.wait("@createTransaction");
        cy.dt("alert-bar-success").should("be.visible").and("have.text", "Transaction Submitted!");

        const updatedUserBalance = Dinero({
            amount: ctx.user.balance - parseInt(payment.amount) * 100,
        }).toFormat();

        cy.dt("sidenav-user-balance").should("contain", updatedUserBalance);

        cy.dt("new-transaction-return-to-transactions").click();
        cy.dt("nav-personal-tab").click();
        cy.dtl("personal-tab").should("have.class", "Mui-selected");
        cy.wait("@personalTransactions");
        const transactionItems = [payment.amount, payment.note, ctx.contact.firstName];
        transactionItems.forEach((item) => {
            cy.dtl("transaction-item").first().should("contain", item);
        });

        //switch to Contact to check UI balance
        cy.switchUserByXstate(ctx.contact.username);

        const updatedContactBalance = Dinero({
            amount: ctx.contact.balance + parseInt(payment.amount) * 100,
        }).toFormat();

        cy.dt("sidenav-user-balance").should("contain", updatedContactBalance);
        cy.dt("nav-personal-tab").click();
        cy.dtl("personal-tab").should("have.class", "Mui-selected");
        cy.wait("@personalTransactions");
        transactionItems.forEach((item) => {
            cy.dtl("transaction-item").first().should("contain", item);
        });

        //check database
        cy.database("find", "users", { id: ctx.user.id })
            .its("balance")
            .should("equal", ctx.user.balance - parseInt(payment.amount) * 100);

        cy.database("find", "users", { id: ctx.contact.id })
            .its("balance")
            .should("equal", ctx.contact.balance + parseInt(payment.amount) * 100);
    });

    it("Submit a transaction request then accept it as contact", () => {
        const payment = {
            amount: "18",
            note: "New phone case 📲"
        }

        cy.wait("@allUsers");
        cy.dtl("search-input").type(ctx.contact.username);
        cy.dtl("user-list-item").contains(ctx.contact.username).click();
        cy.dtl("amount-input").type(payment.amount);
        cy.dtl("description-input").type(payment.note);
        cy.dtl("submit-request").click();
        cy.get("h2").contains(ctx.contact.firstName).should("be.visible");

        const formattedPayment = Dinero({
            amount: parseInt(payment.amount) * 100,
        }).toFormat();

        //perhaps write some of these repeating functions before so they aren't redundant
        cy.get("h2").then((h2) => {
            const confirmationNote = h2[1].innerText;
            expect(confirmationNote).to.eq(`Requested ${formattedPayment} for ${payment.note}`);
        });

        cy.wait("@createTransaction");
        cy.dt("alert-bar-success").should("be.visible").and("have.text", "Transaction Submitted!");
        cy.dt("new-transaction-return-to-transactions").click();

        cy.dt("nav-personal-tab").click();
        cy.dtl("personal-tab").should("have.class", "Mui-selected");
        cy.wait("@personalTransactions");

        const transactionItems = [payment.amount, payment.note, ctx.contact.firstName];
        transactionItems.forEach((item) => {
            cy.dtl("transaction-item").first().should("contain", item);
        });

        //switch to contact
        cy.switchUserByXstate(ctx.contact.username);
        cy.dt("nav-personal-tab").click();
        cy.dtl("personal-tab").should("have.class", "Mui-selected");
        cy.wait("@personalTransactions");
        transactionItems.forEach((item) => {
            cy.dtl("transaction-item").first().should("contain", item);
        });
        cy.dtl("transaction-item").first().click();
        cy.dtl("transaction-accept-request").click();
        cy.dtl("transaction-item").should("contain", "charged").and("contain", `${ctx.contact.firstName}`);

        const updatedUserAccountBalance = Dinero({
            amount: ctx.user.balance + parseInt(payment.amount) * 100,
        }).toFormat();

        const updatedContactAccountBalance = Dinero({
            amount: ctx.contact.balance - parseInt(payment.amount) * 100,
        }).toFormat();

        //switch back to user to check account balance
        cy.switchUserByXstate(ctx.user.username);
        cy.dt("sidenav-user-balance").should("contain", updatedUserAccountBalance);
        //switch back to contact to check account balance
        cy.switchUserByXstate(ctx.contact.username);
        cy.dt("sidenav-user-balance").should("contain", updatedContactAccountBalance);

        //check db for user and contact for change these ended up being accurate, but the UI didn't change.
        cy.database("find", "users", { id: ctx.user.id })
        .its("balance")
        .should("equal", ctx.user.balance + parseInt(payment.amount) * 100);
        
        cy.database("find", "users", { id: ctx.contact.id })
        .its("balance")
        .should("equal", ctx.contact.balance - parseInt(payment.amount) * 100);
    });

    it("Displays proper new-transaction form errors", () => {
        cy.wait("@allUsers");
        cy.dtl("search-input").type(ctx.contact.username);
        cy.dtl("user-list-item").contains(ctx.contact.username).click();
        
        //amount
        cy.dtl("amount-input").type("700");
        cy.dtl("amount-input").find("input").clear();
        cy.dtl("amount-input").find("input").blur();
        cy.get("#transaction-create-amount-input-helper-text")
        .should("be.visible")
        .and("have.text", "Please enter a valid amount");

        //description
        cy.dtl("description-input").type("700");
        cy.dtl("description-input").find("input").clear();
        cy.dtl("description-input").find("input").blur();
        cy.get("#transaction-create-description-input-helper-text")
        .should("be.visible")
        .and("have.text", "Please enter a note");
        
        cy.dtl("submit-request").should("be.disabled");
        cy.dtl("submit-payment").should("be.disabled");
    });


    context("Search for contact with search attributes", () => {
        const searchAttrs = ["firstName", "lastName", "username", "email", "phoneNumber"];

        beforeEach(function () {
            cy.dtl("new-transaction").click();
            cy.wait("@allUsers");
        });

        searchAttrs.forEach((attr) => {
            it(attr, () => {
                const targetUser = ctx.allUsers[1];
                cy.dtl("search-input").type(targetUser[attr]);
                cy.wait("@usersSearch")
                .its("response.body.results")
                .should("have.length.gt", 0)
                .its("length")
                .then((resultsN) => {
                    cy.dtl("user-list-item").should("have.length", resultsN).first().contains(targetUser[attr]);
                });
                cy.focused().clear();
                cy.dt("users-list").should("be.empty");
            });
        });
    });
    //didn't do a reject request because there seems to be a bug where even if you reject a request, the request
    //passes as 'accepted' and both parties' balances are changed
});