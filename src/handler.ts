import { Codec, Metadata, Table } from "@serverless-seoul/dynamorm";

import type { DynamoDBStreamEvent } from "./dynamodb_stream_event";

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
