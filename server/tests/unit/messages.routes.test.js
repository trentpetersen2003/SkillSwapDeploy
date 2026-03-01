const express = require("express");
const request = require("supertest");
const messagesRoutes = require("../../routes/messages");
const Message = require("../../models/Message");
const User = require("../../models/User");

const AUTH_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";

jest.mock("../../models/Message");
jest.mock("../../models/User");
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = AUTH_USER_ID;
  next();
});

function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

function makeMessageFindQuery(value) {
  return {
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(value),
      }),
    }),
  };
}

describe("Messages Routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/messages", messagesRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("filters blocked users from conversations", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery({ blockedUsers: [OTHER_USER_ID] });
      }
      return makeSelectQuery({ blockedUsers: [] });
    });

    User.find.mockReturnValue(makeSelectQuery([]));

    Message.find.mockReturnValue(
      makeMessageFindQuery([
        {
          _id: "m1",
          text: "hi",
          sender: { _id: OTHER_USER_ID, name: "Other", username: "other" },
          recipient: { _id: AUTH_USER_ID, name: "Me", username: "me" },
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ])
    );

    const response = await request(app).get("/api/messages/conversations");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("blocks thread fetch when either user is blocked", async () => {
    User.findById.mockImplementation((id) => {
      if (id === OTHER_USER_ID) {
        return makeSelectQuery({ _id: OTHER_USER_ID, blockedUsers: [] });
      }
      if (id === AUTH_USER_ID) {
        return makeSelectQuery({ _id: AUTH_USER_ID, blockedUsers: [OTHER_USER_ID] });
      }
      return makeSelectQuery(null);
    });

    const response = await request(app).get(`/api/messages/${OTHER_USER_ID}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Cannot chat with a blocked user");
    expect(Message.updateMany).not.toHaveBeenCalled();
  });

  test("blocks sending messages when either user is blocked", async () => {
    User.findById.mockImplementation((id) => {
      if (id === OTHER_USER_ID) {
        return makeSelectQuery({ _id: OTHER_USER_ID, blockedUsers: [] });
      }
      if (id === AUTH_USER_ID) {
        return makeSelectQuery({ _id: AUTH_USER_ID, blockedUsers: [OTHER_USER_ID] });
      }
      return makeSelectQuery(null);
    });

    const response = await request(app)
      .post(`/api/messages/${OTHER_USER_ID}`)
      .send({ text: "Hello" });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Cannot chat with a blocked user");
    expect(Message.create).not.toHaveBeenCalled();
  });
});
