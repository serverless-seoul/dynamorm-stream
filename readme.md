# Dynamo Types Stream
Framework for DynamoDB Stream Event processing on Lambda. Based on (https://github.com/balmbees/dynamo-typeorm)  
Powering [Vingle](https://www.vingle.net)

## Usage
```typescript
import { Decorator, Query, Table, Config } from "dynamo-types";

// First Define your DynamoDB Table
@Decorator.Table({ name: "prod-Card" })
class Card extends Table {
  @Decorator.Attribute()
  public id: number;

  @Decorator.Attribute()
  public title: string;

  @Decorator.Attribute({ timeToLive: true })
  public expiresAt: number;

  @Decorator.FullPrimaryKey('id', 'title')
  static readonly primaryKey: Query.FullPrimaryKey<Card, number, string>;

  @Decorator.Writer()
  static readonly writer: Query.Writer<Card>;
}

import * as DynamoTypesStream from "dynamo-types-stream";

// This is lambda event handler. "exports.handler"
export const handler = DynamoTypesStream.createLambdaHandler(
  createHandler(
    Card, 
    "Series", 
    [
      {
        eventType: "INSERT", 
        async handler(events) { 
          // Events automatically typed as Array<InsertStreamEvent<Card>>
          events.forEach(event => {
            console.log("New Card! :", event.newRecord.id);
          })
        }
      }, {
        eventType: "REMOVE", 
        async handler(events) { 
          // Events automatically typed as Array<InsertStreamEvent<Card>>
          events.forEach(event => {
            console.log("New Card! :", event.newRecord.id);
          })
        }
      }
    ]
  )  
)
```

```typescript
/**
 * 
 * @param tableClass DynamoTypes Class
 * @param strategy handler Execution strategy. Map execute all handlers once, Series excute handlers one by one
 * @param handlers 
 */
export function createHandler<T extends Table>(
  tableClass: ITable<T>,
  strategy: "Map" | "Series" = "Series",
  handlers: Array<HandlerDefinition<T>>
)
```