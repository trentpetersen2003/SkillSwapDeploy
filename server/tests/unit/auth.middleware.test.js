const auth = require("../../middleware/auth");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("auth middleware returns 401 when no token is provided", () => {
  const req = { headers: {} };
  const res = mockRes();
  const next = jest.fn();

  auth(req, res, next);

  expect(res.statusCode).toBe(401);
  expect(next).not.toHaveBeenCalled();
});
