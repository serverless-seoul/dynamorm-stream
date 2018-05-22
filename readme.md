# Dynamo Types Stream
Framework for DynamoDB Stream Event processing on Lambda. Based on (https://github.com/balmbees/dynamo-typeorm)
Powering [Vingle](https://www.vingle.net)

## What is this for?
When you're using DynamoDB, it's common pattern to connect DynamoDB Stream to Lambda to do data change based background works.   
For example, Let's say you want to send notification to slack when new DynamooDB Record is inserted  
Then commonly, you connect DynamoDB Stream to lambda and wrote

```typescript
export function handler(event, content) {
  event.records.forEach((record) => {
    if (record.eventName === "INSERT") {
      SlackNotifier.notify(`${record.dynamodb.newImage.S}`);
    }
  })
}
```

But clearly, there are some missing things here,

### 1) DynamoDB Record Parsing (ORM)
  Raw event format for DynamoDB Stream is pretty complicated.  
  { a: 100 } represented as { a: { N: 100 } }, and there are [many other things](https://github.com/balmbees/dynamo-typeorm-stream/blob/master/src/dynamodb_stream_event.ts) you need know how to parse
### 2) Error Handling
  It's also common to connect several background process for single table.  
  For example, let's say you want to 
  a. Get slack notification when new record inserted
  b. Backup the record to S3 if the record removed  
  Then you would wrote code like
```typescript
export function handler(event, content) {
  await notifySlack(event.records.filter(record => record.eventName === "INSERT"));
  await backuptoS3(event.records.filter(record => record.eventName === "REMOVE"));
}
```
  And this is really dangerous if `backuptoS3` throws Error.  
  In that case, whole Lambda invocation go to error, thus this batch of DynamoDB Stream events marked as failed.  
  And when DynamoDB Stream failed to process some events, it retries with same events until either events expires (24 hours after created) or process successed    
  So if there is bug on `backuptoS3`, you'll get slack notification infinitely   
  To avoid this, you should do something like  
```typescript
export function handler(event, content) {
  try {
    await notifySlack(event.records.filter(record => record.eventName === "INSERT"));
  } catch (e) {
    console.error(e);    
  }

  try {
    await backuptoS3(event.records.filter(record => record.eventName === "REMOVE"));
  } catch (e) {
    console.error(e);    
  }
}
```
  Not that cool right?


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
        name: "New Card Informer",
        async handler(events) {
          // Events automatically typed as Array<InsertStreamEvent<Card>>
          events.forEach(event => {
            console.log("New Card! :", event.newRecord.id);
          })
        },
      }, {
        eventType: "INSERT",
        name: "New Card Error",
        async handler(events) {
          throw new Error("XXXX");
        },
      }, {
        eventType: "REMOVE",
        name: "Deleted Card Informer",
        async handler(events) {
          // Events automatically typed as Array<RemoveStreamEvent<Card>>
          events.forEach(event => {
            console.log("Deleted Card! :", event.newRecord.id);
          })
        }
      }
    ],
    async catchError(handlerDefintion, events, error) {
      // This is global Error handler
      console.log(handlerDefintion.name, events, error)
      // --> "New Card Error", [{ event: "deleted", oldRecord: new Card(), new Error("XXX")];
    }
  )
)
```

And `createLambdaHandler` is optional as you can imagine. if you already have your own wrapper for lambda function  
you might only use `createHandler`, which is `(event: LambdaEvent) => Promise<void>`

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
