import { Table } from "dynamo-types";

import {
  HandlerDefinition,
  ITable,
  parseEvent,
  StreamEvent,
} from "./handler";

import { DynamoDBStreamEvent } from "./dynamodb_stream_event";

export class TableHandler<T extends Table> {
  constructor(
    public readonly tableClass: ITable<T>,
    private readonly strategy: "Map" | "Series" = "Series",
    private readonly handlers: Array<HandlerDefinition<T>>,
    private readonly catchError: (
      handlerDefinition: HandlerDefinition<T>,
      events: Array<StreamEvent<T>>,
      error: Error
    ) => Promise<void> | void
  ) {
  }

  public get handler() {
    return async (event: DynamoDBStreamEvent): Promise<void> => {
      const records = parseEvent(this.tableClass, event);

      switch (this.strategy) {
        case "Series":
          for (const handler of this.handlers) {
            try {
              await executeHandler(handler, records);
            } catch (error) {
              this.catchError(handler, records, error);
            }
          }
          break;
        case "Map":
          await Promise.all(
            this.handlers.map(async (handler) => {
              try {
                await executeHandler(handler, records);
              } catch (error) {
                this.catchError(handler, records, error);
              }
            })
          );
          break;
      }
    };
  }
}

async function executeHandler<T>(handlerDefinition: HandlerDefinition<T>, records: Array<StreamEvent<T>>) {
  const { handler, filteredRecords } = (() => {
    switch (handlerDefinition.eventType) {
      case "INSERT":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(records.map((record) => record.type === "INSERT" ? record : null))
        };
      case "MODIFY":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(records.map((record) => record.type === "MODIFY" ? record : null)),
        };
      case "REMOVE":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(records.map((record) => record.type === "REMOVE" ? record : null)),
        };
      case "INSERT, MODIFY":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(
            records.map((record) => record.type === "INSERT" || record.type === "MODIFY" ? record : null)),
        };
      case "MODIFY, REMOVE":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(
            records.map((record) => record.type === "MODIFY" || record.type === "REMOVE" ? record : null)),
        };
      case "INSERT, REMOVE":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(
            records.map((record) => record.type === "INSERT" || record.type === "REMOVE" ? record : null)),
        };
      case "ALL":
        return {
          handler: handlerDefinition.handler,
          filteredRecords: valueFilter(records),
        };
    }
  })();

  if (filteredRecords.length > 0) {
    await handler(filteredRecords);
  }
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
