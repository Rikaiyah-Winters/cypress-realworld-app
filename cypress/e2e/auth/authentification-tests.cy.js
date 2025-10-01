import { isMobile } from "../../support/utils";
const apiGraphQL = `${Cypress.env("apiUrl")}/graphql`;
const users = require('../../fixtures/users.json');
const authUser = users[0];


describe("Authotization Tests (Login and SignUp)", () => {
    beforeEach(() => {
        cy.task("db:seed");
        cy.intercept("POST", "/users").as("addNewUser");
        cy.intercept("POST", apiGraphQL, (req) => {
            const body = req.body;

            if (body.hasOwnProperty("operationName") && body.operationName === "CreateBankAccount") {
                req.alias = "gqlCreateBankAccountMutation";
            }
        });
        cy.visit("/signin");
    });

    it("Redirects unauthenticated user to signin page", () => {
        cy.visit("/testpage");
        cy.url().should("contain", "/signin");
        cy.location("pathname").should("equal", "/signin");

    });

    it("Authenticated user logs in sucessfully", () => {
        cy.login(authUser.username, "s3cret");
        cy.dt("sidenav-username").should("contain", "Heath93");
    });

    it("Create new user, sign in, and log out", () => {
        const newUser = {
            firstName: "Pochacco",
            lastName: "White",
            username: "sconeclone",
            password: "f3buary",
            bankName: "Sanrio Bank",
            routingNumber: "123456789",
            accountNumber: "987654321",
        }

        //fill sign up form
        cy.visit("/");
        cy.dt("signup").click();
        cy.dtl("first-name").type(newUser.firstName);
        cy.dtl("last-name").type(newUser.lastName);
        cy.dtl("username").type(newUser.username);
        cy.dtl("password").type(newUser.password);
        cy.dtl("confirmPassword").type(newUser.password);
        cy.dtl("submit").click();
        cy.wait("@addNewUser");
        cy.url().should("contain", "/signin");

        //sign in as new user
        cy.login(newUser.username, newUser.password);
        cy.url().should("contain", "/");

        //set up account
        cy.dt("sidenav-username").should("contain", newUser.username);
        cy.dt("user-onboarding-dialog-title").should("be.visible");
        cy.dt("user-onboarding-next").click();
        cy.get("#bankaccount-bankName-input").type(newUser.bankName);
        cy.get("#bankaccount-routingNumber-input").type(newUser.routingNumber);
        cy.get("#bankaccount-accountNumber-input").type(newUser.accountNumber);
        cy.dt("bankaccount-submit").click();
        cy.wait("@gqlCreateBankAccountMutation");
        cy.dt("user-onboarding-next").click();
        cy.dt("sidenav-username").should("contain", newUser.username);

        //log out
        if (isMobile()) {
            cy.dt("sidenav-toggle").click();
        }
        cy.dt("sidenav-signout").click();
        cy.url().should("contain", "/signin");
    })

    it("Sign in form errors are visible", () => {
        cy.dtl("username").type("p");
        cy.dtl("username").find("input").clear();
        cy.dtl("username").find("input").blur();
        cy.get("#username-helper-text").should("be.visible").and("have.text", "Username is required");
        cy.dtl("password").type("p");
        cy.dtl("password").find("input").blur();
        cy.get("#password-helper-text").should("be.visible").and("have.text", "Password must contain at least 4 characters");
        cy.dt("signin-submit").should("be.disabled");
    });

    context("Username or password errors", () => {
        it("Error thrown for invalid password for existing user", () => {
            cy.login(authUser.username, "pass");
            cy.dt("signin-error").should("be.visible").and("have.text", "Username or password is invalid");
        });

        it("Error thrown for unauthorized user", () => {
            cy.login("username", "pass");
            cy.dt("signin-error").should("be.visible").and("have.text", "Username or password is invalid");
        });
    });

    it("Sign up form errors", () => {
        cy.dt("signup").click();

        //first name 
        cy.dtl("first-name").type("p");
        cy.dtl("first-name").find("input").clear();
        cy.dtl("first-name").find("input").blur();
        cy.get("#firstName-helper-text").should("have.text", "First Name is required");

        //last name
        cy.dtl("last-name").type("p");
        cy.dtl("last-name").find("input").clear();
        cy.dtl("last-name").find("input").blur();
        cy.get("#lastName-helper-text").should("have.text", "Last Name is required");

        //username
        cy.dtl("username").type("p");
        cy.dtl("username").find("input").clear();
        cy.dtl("username").find("input").blur();
        cy.get("#username-helper-text").should("have.text", "Username is required");

        //password
        cy.dtl("password").type("p");
        cy.dtl("password").find("input").clear();
        cy.dtl("password").find("input").blur();
        cy.get("#password-helper-text").should("have.text", "Enter your password");
        cy.dtl("password").type("p");
        cy.get("#password-helper-text").should("have.text", "Password must contain at least 4 characters");
        cy.dtl("password").type("aaabbb");

        //confirm password
        cy.dtl("confirmPassword").type("a");
        cy.get("#confirmPassword-helper-text").should("have.text", "Password does not match");
        cy.dtl("confirmPassword").find("input").clear();
        cy.dtl("confirmPassword").find("input").blur();
        cy.get("#confirmPassword-helper-text").should("have.text", "Confirm your password");
        cy.dt("signup-submit").should("be.disabled");
    });
});