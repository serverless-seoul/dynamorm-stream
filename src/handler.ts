import { Codec, Metadata, Table } from "dynamo-types";

// Helpers
import { DynamoDBStreamEvent } from "./dynamodb_stream_event";
import { LambdaContext } from "./lambda_context";

export interface InsertStreamEvent<T> {
  type: "INSERT";
  newRecord: T;
}

export interface ModifyStreamEvent<T> {
  type: "MODIFY";
  oldRecord: T;
  newRecord: T;
}

export interface RemoveStreamEvent<T> {
  type: "REMOVE";
  oldRecord: T;
}

export type StreamEvent<T> = (
  InsertStreamEvent<T>
  | ModifyStreamEvent<T>
  | RemoveStreamEvent<T>
);

// tslint:disable-next-line
export interface ITable<T extends Table> {
  metadata: Metadata.Table.Metadata;
  new (): T;
}

export function parseEvent<T extends Table>(
  tableClass: ITable<T>, event: DynamoDBStreamEvent,
): Array<StreamEvent<T>> {
  return event.Records.map((record) => {
    switch (record.eventName) {
      case "INSERT":
        return {
          type: "INSERT" as "INSERT",
          newRecord: Codec.unmarshal(tableClass, record.dynamodb.NewImage),
        };
      case "MODIFY":
        return {
          type: "MODIFY" as "MODIFY",
          oldRecord: Codec.unmarshal(tableClass, record.dynamodb.OldImage),
          newRecord: Codec.unmarshal(tableClass, record.dynamodb.NewImage),
        };
      case "REMOVE":
        return {
          type: "REMOVE" as "REMOVE",
          oldRecord: Codec.unmarshal(tableClass, record.dynamodb.OldImage),
        };
    }
  });
}

function valueFilter<T>(array: Array<T | undefined | null>) {
  const res: T[] = [];
  array.forEach((item) => {
    if (item !== undefined && item !== null) {
      res.push(item);
    }
  });
  return res;
}

export function createLambdaHandler(handler: (event: DynamoDBStreamEvent) => Promise<void>) {
  return async (event: DynamoDBStreamEvent, context: LambdaContext) => {
    handler(event).then(
      () => context.succeed(),
      (error) => context.fail(error),
    );
  };
}

export type HandlerDefinition<T> = {
  eventType: "INSERT",
  name: string,
  handler: (events: Array<InsertStreamEvent<T>>) => Promise<void>,
} | {
  eventType: "MODIFY",
  name: string,
  handler: (events: Array<ModifyStreamEvent<T>>) => Promise<void>,
} | {
  eventType: "REMOVE",
  name: string,
  handler: (events: Array<RemoveStreamEvent<T>>) => Promise<void>,
} | {
  eventType: "INSERT, MODIFY",
  name: string,
  handler: (events: Array<InsertStreamEvent<T> | ModifyStreamEvent<T>>) => Promise<void>,
} | {
  eventType: "MODIFY, REMOVE",
  name: string,
  handler: (events: Array<ModifyStreamEvent<T> | RemoveStreamEvent<T>>) => Promise<void>,
} | {
  eventType: "INSERT, REMOVE",
  name: string,
  handler: (events: Array<InsertStreamEvent<T> | RemoveStreamEvent<T>>) => Promise<void>,
} | {
  eventType: "ALL",
  name: string,
  handler: (events: Array<StreamEvent<T>>) => Promise<void>,
};

/**
 *
 * @param tableClass DynamoTypes Class
 * @param strategy handler Execution strategy. Map execute all handlers once, Series excute handlers one by one
 * @param handlers
 */
export function createTableHandler<T extends Table>(
  tableClass: ITable<T>,
  strategy: "Map" | "Series" = "Series",
  handlers: Array<HandlerDefinition<T>>,
  catchError: (
    handlerDefinition: HandlerDefinition<T>,
    events: Array<StreamEvent<T>>,
    error: Error
  ) => Promise<void> | void
) {
  return async (event: DynamoDBStreamEvent): Promise<void> => {
    const records = parseEvent(tableClass, event);

    switch (strategy) {
      case "Series":
        for (const handler of handlers) {
          try {
            await executeHandler(handler, records);
          } catch (error) {
            catchError(handler, records, error);
          }
        }
        return;
      case "Map":
        await Promise.all(handlers.map(async (handler) => {
          try {
            await executeHandler(handler, records);
          } catch (error) {
            catchError(handler, records, error);
          }
        }));
        return;
    }
  };
}

function executeHandler<T>(handlerDefinition: HandlerDefinition<T>, records: Array<StreamEvent<T>>) {
  switch (handlerDefinition.eventType) {
    case "INSERT":
      return handlerDefinition.handler(
        valueFilter(records.map((record) => record.type === "INSERT" ? record : null)),
      );
    case "MODIFY":
      return handlerDefinition.handler(
        valueFilter(records.map((record) => record.type === "MODIFY" ? record : null)),
      );
    case "REMOVE":
      return handlerDefinition.handler(
        valueFilter(records.map((record) => record.type === "REMOVE" ? record : null)),
      );
    case "INSERT, MODIFY":
      return handlerDefinition.handler(
        valueFilter(records.map((record) => record.type === "INSERT" || record.type === "MODIFY" ? record : null)),
      );
    case "MODIFY, REMOVE":
      return handlerDefinition.handler(
        valueFilter(records.map((record) => record.type === "MODIFY" || record.type === "REMOVE" ? record : null)),
      );
    case "INSERT, REMOVE":
      return handlerDefinition.handler(
        valueFilter(records.map((record) => record.type === "INSERT" || record.type === "REMOVE" ? record : null)),
      );
    case "ALL":
      return handlerDefinition.handler(valueFilter(records));
  }
}
