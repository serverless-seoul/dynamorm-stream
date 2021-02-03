import type { Context } from "aws-lambda";
import * as debug from "debug";

import type { DynamoDBStreamEvent } from "./dynamodb_stream_event";
import type { TableHandler } from "./table_handler";

const logger = debug("@serverless-seoul/dynamorm-stream:StreamHandler");

export class StreamHandler {
  public readonly tableHandlerMap: Map<string, TableHandler<any>>;
  constructor(
    tableHandlers: Array<TableHandler<any>>
  ) {
    this.tableHandlerMap = new Map();

    tableHandlers.forEach(handler => {
      const tableName = handler.tableClass.metadata.name;
      if (this.tableHandlerMap.has(tableName)) {
        throw new Error(`You can't put more than one handler for given table: ${tableName}`);
      }

      this.tableHandlerMap.set(tableName, handler);
    });
  }

  public get handler() {
    return async (event: DynamoDBStreamEvent) => {
      if (event.Records.length > 0) {
        // Even though each records has own eventSourceARN,
        // one event only has one eventSoruceARN.
        // Thus, select "one" event source arn.
        const sourceARN = event.Records[0].eventSourceARN;
        logger("handler: sourceARN - %s", sourceARN);
        const streamMetadata = parseDynamoDBStreamARN(sourceARN);
        if (!streamMetadata) {
          throw new Error(`Invalid Source Arn : ${sourceARN}`);
        }

        const handler = this.tableHandlerMap.get(streamMetadata.tableName);
        if (handler) {
          logger("handler: start table handler: %s", streamMetadata.tableName);
          await handler.handler(event);
        } else {
          logger("handler: sourceARN - %s, There is no table handler for arn", sourceARN);
        }
      }
    };
  }

  public get lambdaHandler() {
    return async (event: DynamoDBStreamEvent, context: Context) => {
      context.callbackWaitsForEmptyEventLoop = false;
      return await this.handler(event);
    };
  }
}

/**
 *
 * @param arn
 * @returns - null means invalid arn
 */

// arn:aws:dynamodb:us-east-1:921281748045:table/qna_production_questions/stream/2017-12-22T02:02:25.496
export function parseDynamoDBStreamARN(arn: string) {
  const arnRegex = /arn:aws:dynamodb:(\w+-\w+-\d):(\d+):table\/(\w+)\/stream\/(\S+)/;
  const match = arn.match(arnRegex);
  if (match && match.length === 5) {
    return {
      region: match[1],
      awsAccountId: match[2],
      tableName: match[3],
    };
  } else {
    return null;
  }
}
