describe("SkillSwap smoke test", () => {
  it("loads the app", () => {
    cy.visit("http://localhost:3000");
    cy.get("body").should("be.visible");
  });
});