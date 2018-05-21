import * as chai from "chai";
const expect = chai.expect;

import { Config, Decorator, Query, Table} from "dynamo-types";

@Decorator.Table({ name: `cards` })
class Card extends Table {
  @Decorator.FullPrimaryKey("id", "title")
  public static readonly primaryKey: Query.FullPrimaryKey<Card, number, string>;

  @Decorator.HashGlobalSecondaryIndex("title")
  public static readonly titleIndex: Query.HashGlobalSecondaryIndex<Card, string>;

  @Decorator.Writer()
  public static readonly writer: Query.Writer<Card>;

  @Decorator.Attribute()
  public id: number;

  @Decorator.Attribute()
  public title: string;

  // @Decorator.Attribute({ timeToLive: true })
  @Decorator.Attribute()
  public expiresAt: number;
}

beforeEach(async () => {
  await Card.createTable();
});

afterEach(async () => {
  await Card.dropTable();
});

import { createTableHandler, createLambdaHandler } from "../index";

const handler = createLambdaHandler(
  createTableHandler(Card, "Series", [
    {
      eventType: "INSERT",
      async handler(events) {
        //
      },
    },
  ]),
);
