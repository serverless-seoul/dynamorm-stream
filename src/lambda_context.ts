// Response
interface Response {
  statusCode: number;
  headers: {
    [key: string]: any;
    "Content-Type": string;
  };
  body: string;
}

export interface LambdaContext {
  // Properties
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: number;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;

  // Functions
  succeed(result?: object): void;
  fail(error: Error): void;
  done(error: Error | null, result?: Response): void; // result must be JSON.stringifyable
  getRemainingTimeInMillis(): number;
}
