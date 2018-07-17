import { expect } from "chai";

import * as AWS from "aws-sdk";

import { Decorator, Query, Table } from "dynamo-types";

// tslint:disable-next-line:max-classes-per-file
@Decorator.Table({ name: `cards` })
class Card extends Table {
  @Decorator.HashPrimaryKey("id")
  public static readonly primaryKey: Query.HashPrimaryKey<Card, number>;

  @Decorator.Attribute()
  public id: number;

  @Decorator.Attribute()
  public title: string;
}

// tslint:disable-next-line:max-classes-per-file
@Decorator.Table({ name: `users` })
class User extends Table {
  @Decorator.HashPrimaryKey("id")
  public static readonly primaryKey: Query.HashPrimaryKey<User, number>;

  @Decorator.Attribute()
  public id: number;

  @Decorator.Attribute()
  public username: string;
}


beforeEach(async () => {
  await Card.createTable();
  await User.createTable();
});

afterEach(async () => {
  await Card.dropTable();
  await User.dropTable();
});

import { StreamHandler, TableHandler } from "../index";

describe("E2E", () => {
  let streamHandler: StreamHandler;
  let userInsertHandlerCalled: boolean;
  let userRemoveHandlerCalled: boolean;
  let cardHandlerCalled: boolean;
  beforeEach(() => {
    userInsertHandlerCalled = false;
    userRemoveHandlerCalled = false;
    const userHandler = new TableHandler(
      User, "Series",
      [{
        eventType: "INSERT",
        name: "Test Handler",
        async handler(events) {
          userInsertHandlerCalled = true;
        },
      }, {
        eventType: "REMOVE",
        name: "Test Handler",
        async handler(events) {
          userRemoveHandlerCalled = true;
        },
      }],
      async (handlerDef, events, error) => {
        // tslint:disable-next-line
        console.log(handlerDef.name, events, error);
      });

    cardHandlerCalled = false;
    const cardHandler = new TableHandler(
      Card, "Series",
      [{
        eventType: "INSERT",
        name: "Test Handler",
        async handler(events) {
          cardHandlerCalled = true;
        },
      }],
      async (handlerDef, events, error) => {
        // tslint:disable-next-line
        console.log(handlerDef.name, events, error);
      });

    streamHandler = new StreamHandler([
      userHandler,
      cardHandler,
    ]);
  });

  it("should execute proper handler depends on event", async () => {
    const user = new User();
    user.id = 100;
    user.username = "MEMEME";

    await streamHandler.handler({
      Records: [{
        eventName: "INSERT",
        dynamodb: {
          ApproximateCreationDateTime: 1489631700,
          NewImage: AWS.DynamoDB.Converter.marshall(user.serialize()),
        },
        eventSourceARN: "arn:aws:dynamodb:us-east-1:921281748045:table/users/stream/2017-12-22T02:02:25.496"
      } as any]
    });

    expect(userInsertHandlerCalled).to.be.eq(true);
    // Since there is only "Insert" event, this should not be called
    expect(userRemoveHandlerCalled).to.be.eq(false);

    expect(cardHandlerCalled).to.be.eq(false);
  });
});

describe(StreamHandler.name, () => {
  it("should raise error if there are duplicated table handler", async () => {
    expect(() => {
      return new StreamHandler([
        new TableHandler(
          User, "Series",
          [{
            eventType: "INSERT", name: "Test Handler",
            async handler(events) {
              //
            },
          }],
          async (handlerDef, events, error) => {
            //
          }),
        new TableHandler(
          User, "Series",
          [{
            eventType: "INSERT",
            name: "Test Handler",
            async handler(events) {
              //
            },
          }],
          async (handlerDef, events, error) => {
            //
          })
      ]);
    }).to.throw("You can't put more than one handler for given table: users");
  });
});
