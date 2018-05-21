import * as AWS from "aws-sdk";

export type KeySchema = AWS.DynamoDB.AttributeMap;
export type DataSchema = AWS.DynamoDB.AttributeMap;

export interface DynamoDBStreamCommonEventRecord {
  eventID: string;
  eventName: string;
  eventVersion: string;
  eventSource: "aws:dynamodb";
  awsRegion: string;
  eventSourceARN: string;
}

export interface DynamoDBStreamInsertEventRecord
  extends DynamoDBStreamCommonEventRecord {
  eventName: "INSERT";
  dynamodb: {
    ApproximateCreationDateTime: number; // 1489546380,
    Keys: KeySchema;
    NewImage: DataSchema;
    SequenceNumber: string; //  "296894900000000020087603447",
    SizeBytes: number;
    StreamViewType: string; // "NEW_AND_OLD_IMAGES"
  };
}

export interface DynamoDBStreamModifyEventRecord
  extends DynamoDBStreamCommonEventRecord {
  eventName: "MODIFY";
  dynamodb: {
    ApproximateCreationDateTime: number;
    Keys: KeySchema;
    NewImage: DataSchema;
    OldImage: DataSchema;
    SequenceNumber: string;
    SizeBytes: number;
    StreamViewType: string;
  };
}

export interface DynamoDBStreamRemoveEventRecord
  extends DynamoDBStreamCommonEventRecord {
  eventName: "REMOVE";
  dynamodb: {
    ApproximateCreationDateTime: number;
    Keys: KeySchema;
    OldImage: DataSchema;
    SequenceNumber: string;
    SizeBytes: number;
    StreamViewType: string;
  };
}

export type DynamoDBStreamEventRecord
  = (
    DynamoDBStreamInsertEventRecord
    | DynamoDBStreamModifyEventRecord
    | DynamoDBStreamRemoveEventRecord
  );

export interface DynamoDBStreamEvent {
  Records: DynamoDBStreamEventRecord[];
}
