describe("Transaction View", () => {
    const ctx = {};

    beforeEach(() => {
        cy.task("db:seed");

        cy.intercept("GET", "/transactions*").as("personalTransactions");
        cy.intercept("GET", "/transactions/public*").as("publicTransactions");
        cy.intercept("GET", "/transactions/*").as("getTransaction");
        cy.intercept("PATCH", "/transactions/*").as("updateTransaction");

        cy.intercept("GET", "/checkAuth").as("userProfile");
        cy.intercept("GET", "/notifications").as("getNotifications");
        cy.intercept("GET", "/bankAccounts").as("getBankAccounts");

        cy.database("find", "users").then((user) => {
            ctx.authUser = user;

            cy.loginByXstate(ctx.authUser.username);

            cy.database("find", "transactions", {
                receiverId: ctx.authUser.id,
                status: "pending",
                requestStatus: "pending",
                requestResolvedAt: ""
            }).then((transaction) => {
                ctx.transactionRequest = transaction;
            });
        });
        cy.dt("nav-personal-tab").click();
        cy.wait("@personalTransactions");
    });

    it("Navigation tabs are hidden on a transaction detail page", () => {
        cy.dtl("transaction-item").first().click();
        cy.url().should("contain", "/transaction");
        cy.dt("nav-transaction-tabs").should("not.exist");
        cy.dt("transaction-detail-header").should("be.visible");
    });

    it("User likes a transaction", () => {
        cy.dtl("transaction-item").first().click();
        cy.dtl("like-button").click();
        cy.dtl("like-count").should("contain", 2);
        cy.dtl("like-button").should("be.disabled");
    });

    it("User comments on a transaction", () => {
        cy.dtl("transaction-item").first().click();
        cy.dtl("comment-input").type("Boop Boop Be Doop {enter}");
        cy.dtl("comment-list-item").first().should("contain", "Boop Boop Be Doop");
        cy.dtl("comment-list-item").should("have.length", 1);
    });

    it("User accepts a request", () => {
        cy.visit(`/transaction/${ctx.transactionRequest.id}`);
        cy.wait("@getTransaction");

        cy.dtl("accept-request").click();
        cy.dtl("transaction-action").should("contain", "charged");
        cy.wait("@updateTransaction").its("response.statusCode").should("equal", 204);
        cy.dtl("accept-request").should("not.exist");
    });

    it("User denies a request", () => {
        cy.visit(`/transaction/${ctx.transactionRequest.id}`);
        cy.wait("@getTransaction");

        cy.dtl("reject-request").click();
        cy.dtl("transaction-action").should("contain", "requested");
        cy.wait("@updateTransaction").its("response.statusCode").should("equal", 204);
        cy.dtl("reject-request").should("not.exist");
    });

    it("doesn't display accept/reject buttons on a completed request", () => {
        cy.database("find", "transactions", {
            receiverId: ctx.authUser.id,
            status: "complete",
            requestStatus: "accepted",
        }).then((transactionRequest) => {
            cy.visit(`/transaction/${transactionRequest.id}`);

            cy.dtl("accept-request").should("not.exist");
            cy.dtl("reject-request").should("not.exist");
            cy.dtl("detail-header").should("be.visible");
            cy.dtl("transaction-action").should("contain", "charged");
        });

    });
});