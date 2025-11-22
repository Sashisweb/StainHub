import * as os from 'os';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as ssl from 'tls';
import * as mysql from 'mysql2/promise';
import { Kafka, logLevel, Consumer, EachMessagePayload } from 'kafkajs';
import * as https from 'https';
import axios, { AxiosResponse } from 'axios';
import { test, expect } from '@playwright/test';
import { NodeHttpHandler } from "@smithy/node-http-handler";

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { BatchClient, SubmitJobCommand, DescribeJobsCommand, CancelJobCommand, TerminateJobCommand } from "@aws-sdk/client-batch";
import { fromIni } from "@aws-sdk/credential-providers";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { 
    
    AthenaClient, 
    StartQueryExecutionCommand, 
    GetQueryExecutionCommand,
    GetQueryResultsCommand
} from "@aws-sdk/client-athena";
import { 
    SQSClient, 
    SendMessageCommand, 
    GetQueueUrlCommand,
    ReceiveMessageCommand
} from "@aws-sdk/client-sqs";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";


const header = { 'content-type': 'application/json' };

const methodToClassMapping: { [key: string]: string } = {
    post: "API",
    get: "API",
    put: "API",
    graphql: "API",
    delete: "API",
    insert: "DB",
    update: "DB",
    select: "DB",
    deletedb: "DB",
    read: "Data",
    write: "Data",
    s3upload: "AWS",
    s3Download: "AWS",
    batch: "AWS",
    secrets: "AWS",
    send_event: "KafkaHandler",
    read_event: "KafkaHandler",
};

export async function backMaticFlow(payload: any, externalParams: any = null, testCase: string | null = null): Promise<any> {
    // Deep clone the workflow to avoid mutations
    const workFlow = JSON.parse(JSON.stringify(payload));
    const flowName = workFlow['flow name'];
    if (flowName) console.log(flowName);

    const steps = workFlow.steps;
    // Initialize parameter store with defaults and external params
    const paramStore = {
        ...workFlow.param_store || {},
        ...externalParams || {}
    };

    Validator.iterateDictValues(paramStore, paramStore);

    for (const step of steps) {

        // Extract step metadata
        const stepMetadata = {
            id: `step ${step.step || ''}`,
            name: step["step name"] || step["flow name"] || '',
            retry: step.retry || 0
        };
        console.log(`${stepMetadata.id} ${stepMetadata.name}`);
        
        Validator.iterateDictValues(step, paramStore);

        if (step.skip_step && step.skip_step === true) {
            console.log(`Skipping step ${step.step}`);
            continue;
        }

        // Prepare operation configuration
        const method = step.action.toLowerCase();
        const type = step.type || methodToClassMapping[method];

        // Execute operation with retries
        let responseId = await executeOperation(type, method, step);
        if (step["log"] === true) {
            console.log('responseId', JSON.stringify(responseId, null, 2));
        }
        
        // Only retry if responseId is null
        let retryCount = stepMetadata.retry;
        let validationPassed = false;
        
        while (retryCount > 0) {
            try {
                // Validate response
                if (responseId) {
                    Validator.validateResponse(step, responseId);
                    validationPassed = true;
                    break;
                }
                if (retryCount > 0) {
                    console.log(`Retrying operation...`);
                    await new Promise(resolve => setTimeout(resolve, parseInt(step.delay, 10) * 1000));
                    responseId = await executeOperation(type, method, step);
                    retryCount--;
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`Validation failed (${retryCount} retries left):`, errorMessage);
                
                // Only retry if we have retries remaining
                if (retryCount > 0) {
                    console.log(`Retrying operation...`);
                    await new Promise(resolve => setTimeout(resolve, parseInt(step.delay, 10) * 1000));
                    responseId = await executeOperation(type, method, step);
                    retryCount--;
                }
            }
        }

        // If validation never passed and we're out of retries, do one final validation that will throw
        if (!validationPassed) {
            Validator.validateResponse(step, responseId);
        }

        if (step.value_map) {
            Validator.storeResponseValues(paramStore, step, responseId);
        }
        if (step.return) {
            return responseId;
        }
        debugger; // This will pause execution when dev tools are open
        if (step.delay) {
            console.log(`Delaying for ${step.delay} seconds...`);
            await new Promise(resolve => setTimeout(resolve, parseInt(step.delay, 10) * 1000));
        }
        
    }
    return paramStore;
}

// Helper function to execute operations
async function executeOperation(type: string, method: string, step: any): Promise<any> {
    const OperationClass = eval(type);
    const operationInstance = new OperationClass(step);
    const operationMethod = operationInstance[method].bind(operationInstance);
    return await operationMethod();
}

class API {
    header: any;
    body: any;
    endPoint: string | null;
    status: number;
    parameter: string;
    valueParams: string;

    constructor(step: any) {
        this.header = step.header || header;
        this.body = step.body || null;
        this.endPoint = step["end point"] || null;
        this.status = step.status || 200;
        this.parameter = step.parameter || '';
        this.valueParams = step.value_params || '';
    }

    async graphql() {
        const { query, variables } = this.body;
        const graphqlBody = JSON.stringify({ query, variables });
        const response = await axios.post(this.endPoint!, graphqlBody, {
            headers: { ...this.header, 'Content-Type': 'application/json' }
        });
        if (response.status !== this.status) {
            throw new Error(`Expected status ${this.status}, but got ${response.status}`);
        }
        return this.getResponse(response);
    }

    async get() {
        try {
            const url = `${this.endPoint}${this.valueParams}`;
            const response = await axios.get(url, {
                headers: this.header
            });

            if (response.status !== this.status) {
                throw new Error(`Expected status ${this.status}, but got ${response.status}`);
            }
            return this.getResponse(response);
        } catch (error: any) {
            console.error('GET request failed:', {
                endpoint: this.endPoint,
                valueParams: this.valueParams,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    async post() {
        
        const response = await axios.post(this.endPoint!, this.body, {
            headers: this.header
        }); 
        if (response.status !== this.status) {
            throw new Error(`Expected status ${this.status}, but got ${response.status}`);
        }
        const responsevalue = await this.getResponse(response);
        return responsevalue
    }

    async put() {
        const response = await axios.put(this.endPoint!, this.body, {
            headers: this.header
        });
        if (response.status !== this.status) {
            throw new Error(`Expected status ${this.status}, but got ${response.status}`);
        }
        return this.getResponse(response);
    }

    async delete() {
        const response = await axios.delete(this.endPoint!, {
            headers: this.header,
            data: this.body  // For delete requests, the body goes in the config object
        });
        if (response.status !== this.status) {
            throw new Error(`Expected status ${this.status}, but got ${response.status}`);
        }
        return this.getResponse(response);
    }

    async patch() {
        const response = await axios.patch(this.endPoint!, this.body, {
            headers: this.header
        });
        if (response.status !== this.status) {
            throw new Error(`Expected status ${this.status}, but got ${response.status}`);
        }
        return this.getResponse(response);
    }

    async getResponse(response: any) {
        try {
            const responseId = Validator.validateJson(response);
            if (responseId.errors && Array.isArray(responseId.errors) && responseId.errors.length === 0) {
                console.log('Found empty errors array, continuing to check other properties');
            }
            else if (responseId.errors) {
                console.log('Found errors in response:', responseId.errors);
                return responseId.errors;
            }
            if (responseId.data) {
                //console.log('Found data in response:', responseId.data);
                return responseId.data;
            }
            if (responseId.result) {
                //console.log('Found result in response:', responseId.result);
                return responseId.result;
            }
            //console.log('Returning full responseId:', responseId);
            return responseId;
        } catch (e) {
            console.error(`Error in getResponse:`, e);

            return null;

        }
    }
}

class DB {
    tableName: string | null;
    schema: string | null;
    columnNames: string[];
    columnValues: any[];
    columns: string;
    hostName: string | null;
    secretName: string | null;
    setColumnNames: string[] | null;
    setColumnValues: any[] | null;
    private step: any;

    constructor(step: any) {
        this.step = step;
        this.tableName = step.table_name?.toLowerCase() || null;
        this.schema = step.schema || null;
        this.columnNames = step.column_names || [];
        this.columnValues = step.column_values || [];
        this.columns = step.columns || "*";
        this.hostName = step.host_name || null;
        this.secretName = step.secret_name || null;
        this.setColumnNames = step.set_column_names || null;
        this.setColumnValues = step.set_column_values || null;
    }

    async executeQuery(connection: any, query: string) {
        try {
            const [rows] = await connection.execute(query);
            await connection.end(); // Properly close the connection
            return rows[0];
        } catch (error) {
            console.error('Database query execution failed:', error);
            await connection.end(); // Ensure connection is closed even on error
            throw error;
        }
    }

    async select() {
        let connection;
        try {
            let queryWhere = this.columnValues.map((value: any, index: number) => 
                `${this.columnNames[index]}=${value}`).join(" and ");
            if (queryWhere) queryWhere = ` where ${queryWhere}`;
            const query = `select ${this.columns} from ${this.tableName} ${queryWhere} order by 1 desc limit 1`;
            console.log('Executing query:', query);
            
            const secretData = await AWS.fetchSecretsUsingSecretManager(this.secretName ?? '', this.step.access_role);
            connection = await this.createConnection(secretData, this.hostName ?? '', this.schema ?? '');
            
            // Increased timeout to 1 minute
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Database query timed out')), 60000);
            });
            
            const queryPromise = this.executeQuery(connection, query);
            return await Promise.race([queryPromise, timeoutPromise]);
        } catch (error) {
            console.error('Database operation failed:', error);
            throw error;
        } finally {
            if (connection) {
                try {
                    await connection.end();
                } catch (error) {
                    console.error('Error closing connection:', error);
                }
            }
        }
    }

    async insert() {
        const columnNames = this.columnNames.join(',');
        const columnValues = this.columnValues.map(value => String(value)).join(',');
        const query = `insert into ${this.tableName} (${columnNames}) values (${columnValues})`;
        console.log(query);
        const secretData = await AWS.fetchSecretsUsingSecretManager(this.secretName ?? '', this.step.access_role);
        const connection = await this.createConnection(secretData, this.hostName ?? '', this.schema ?? '');
        return await this.executeQuery(connection, query);
    }

    async update() {
        let connection;
        try {
            const queryWhere = this.columnValues.map((value, index) =>
                `${this.columnNames[index]}=${value}`
            ).join(' and ');

            const querySet = this.setColumnValues!.map((value, index) =>
                `${this.setColumnNames![index]}=${value}`
            ).join(' , ');

            const query = `update ${this.tableName} set ${querySet} where ${queryWhere}`;
            console.log('Executing update query:', query);
            
            const secretData = await AWS.fetchSecretsUsingSecretManager(this.secretName ?? '', this.step.access_role);
            connection = await this.createConnection(secretData, this.hostName ?? '', this.schema ?? '');
            
            // Add query timeout wrapper
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Database update query timed out after 30 seconds')), 30000);
            });
            
            const queryPromise = this.executeQuery(connection, query);
            return await Promise.race([queryPromise, timeoutPromise]);
        } catch (error) {
            console.error('Database update operation failed:', error);
            throw error;
        } finally {
            if (connection) {
                try {
                    await connection.end();
                } catch (error) {
                    console.error('Error closing connection during update:', error);
                }
            }
        }
    }

    async deletedb() {  // renamed from delete to avoid conflict with JS keyword
        const queryWhere = this.columnValues.map((value, index) =>
            `${this.columnNames[index]}=${value}`
        ).join(' and ');

        const query = `delete from ${this.tableName} where ${queryWhere}`;
        console.log(query);
        const secretData = await AWS.fetchSecretsUsingSecretManager(this.secretName ?? '', this.step.access_role);
        const connection = await this.createConnection(secretData, this.hostName ?? '', this.schema ?? '');
        return await this.executeQuery(connection, query);
    }

    async count() {
        let queryWhere = this.columnValues.map((value, index) =>
            `${this.columnNames[index]}=${value}`
        ).join(' and ');

        if (queryWhere) queryWhere = ` where ${queryWhere}`;
        const query = `select count(*) as count from ${this.tableName} ${queryWhere} order by 1 desc limit 1`;
        console.log(query);
        const secretData = await AWS.fetchSecretsUsingSecretManager(this.secretName ?? '', this.step.access_role);
        const connection = await this.createConnection(secretData, this.hostName ?? '', this.schema ?? '');
        return await this.executeQuery(connection, query);
    }

    async createConnection(secretData: any, hostname: string, dbname: string): Promise<any> {
        const connection = await mysql.createConnection({
            host: dbname ? secretData[`test_${dbname}_host`] : hostname,
            user: dbname ? secretData[`test_${dbname}_user`] : secretData["username"],
            password: dbname ? secretData[`test_${dbname}_password`] : secretData["password"],
            ssl: { rejectUnauthorized: false },
            connectTimeout: 60000, // 30 seconds
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        });
        return connection;
    }
}



interface Step {
    filename: string;
    write_data?: string;
}

class Data {
    filename: string;
    write_data?: string;

    constructor(step: Step) {
        this.filename = step.filename;
        this.write_data = step.write_data;
    }

    async read(): Promise<string[]> {
        try {
            const fileContent = await fsPromises.readFile(this.filename,'utf-8');
            return fileContent.split("\n");  // Returns lines as an array
        } catch (error) {
            console.error(`Error reading file ${this.filename}:`, error);
            throw error;
        }
    }

    async write(): Promise<void> {
        try {
            console.log()
            const content = Array.isArray(this.write_data?.split("\n")) ? this.write_data : ''; // Check if write_data is an array
            console.log(content)
            await fsPromises.writeFile(this.filename, content, 'utf-8');
            console.log(`Data written to ${this.filename}`);
        } catch (error) {
            console.error(`Error writing to file ${this.filename}:`, error);
            throw error;
        }
    }
}



class AWS {
    private step: any;
    s3Client: S3Client;
    secretsManagerClient: SecretsManagerClient;
    batchClient: BatchClient;
    lambdaClient: LambdaClient;
    athenaClient: AthenaClient;
    sqsClient: SQSClient;

    constructor(step: any) {
        this.step = step;
        
        // Create custom HTTPS agent
        const httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 50,
            rejectUnauthorized: true,
            family: 4,
            timeout: 30000
        });

        // Configure clients with the new settings
        const clientConfig = {
            region: "us-west-2",
            requestHandler: new NodeHttpHandler({
                httpAgent: httpsAgent,
                httpsAgent: httpsAgent
            }),
            credentials: fromIni({ profile: 'default' })
        };

        this.s3Client = new S3Client(clientConfig);
        this.secretsManagerClient = new SecretsManagerClient(clientConfig);
        this.batchClient = new BatchClient(clientConfig);
        this.lambdaClient = new LambdaClient(clientConfig);
        this.athenaClient = new AthenaClient(clientConfig);
        this.sqsClient = new SQSClient(clientConfig);
    }

    static async createAssumeRole(accessRole?: string) {
        const regionName = "us-west-2";

        const AWS_ACCOUNT_NONPROD = process.env.AWS_ACCOUNT_NONPROD;
        const GITLAB_GROUP = process.env.GITLAB_GROUP;
        
        // Always start with cross-role
        const crossRole = `arn:aws:iam::${AWS_ACCOUNT_NONPROD}:role/gl-${GITLAB_GROUP}-cross-role`;
        console.log(`First assuming cross-role: ${crossRole}`);
        
        const stsClient = new STSClient(regionName);
        
        try {
            // Step 1: Assume the cross-role
            const crossRoleCommand = new AssumeRoleCommand({
                RoleArn: crossRole,
                RoleSessionName: 'CrossRoleSession',
            });
            const crossRoleResponse = await stsClient.send(crossRoleCommand);
            
            if (!crossRoleResponse.Credentials?.AccessKeyId || 
                !crossRoleResponse.Credentials?.SecretAccessKey || 
                !crossRoleResponse.Credentials?.SessionToken) {
                throw new Error('Failed to get valid credentials from cross-role');
            }
            
            // If accessRole is provided, use cross-role credentials to assume the access-role
            if (accessRole) {
                console.log(`Using cross-role to assume access role: ${accessRole}`);
                
                // Create new STS client with cross-role credentials
                const accessRoleStsClient = new STSClient({
                    region: regionName,
                    credentials: {
                        accessKeyId: crossRoleResponse.Credentials.AccessKeyId,
                        secretAccessKey: crossRoleResponse.Credentials.SecretAccessKey,
                        sessionToken: crossRoleResponse.Credentials.SessionToken
                    }
                });
                
                // Step 2: Assume the access-role using cross-role credentials
                const accessRoleCommand = new AssumeRoleCommand({
                    RoleArn: `arn:aws:iam::${AWS_ACCOUNT_NONPROD}:role/${accessRole}`,
                    RoleSessionName: 'AccessRoleSession',
                });
                const accessRoleResponse = await accessRoleStsClient.send(accessRoleCommand);
                
                if (!accessRoleResponse.Credentials?.AccessKeyId || 
                    !accessRoleResponse.Credentials?.SecretAccessKey || 
                    !accessRoleResponse.Credentials?.SessionToken) {
                    throw new Error('Failed to get valid credentials from access-role');
                }
                
                console.log(`Successfully assumed access role: ${accessRole}`);
                return {
                    accessKeyId: accessRoleResponse.Credentials.AccessKeyId,
                    secretAccessKey: accessRoleResponse.Credentials.SecretAccessKey,
                    sessionToken: accessRoleResponse.Credentials.SessionToken,
                };
            } else {
                // No access-role provided, return cross-role credentials
                console.log(`No access role provided, using cross-role credentials`);
                return {
                    accessKeyId: crossRoleResponse.Credentials.AccessKeyId,
                    secretAccessKey: crossRoleResponse.Credentials.SecretAccessKey,
                    sessionToken: crossRoleResponse.Credentials.SessionToken,
                };
            }
        }
        catch (error) {
            console.error("Error in role assumption chain:", error);
            return undefined;
        }
    }

    async s3upload() {
        try {
            console.log('this.step.filename', this.step);
            const fileContent = fs.readFileSync(this.step.filename);
            
            // Handle GitLab environment with role assumption
            let profilecredentials;
            const isGitLab = process.env.GITLAB_CI === 'true';
            if (isGitLab) {
                let assumedRole = null;
                if (this.step.access_role) {    
                    assumedRole = await AWS.createAssumeRole(this.step.access_role);
                }
                else {
                    assumedRole = await AWS.createAssumeRole();
                }
                if (!assumedRole?.accessKeyId || !assumedRole?.secretAccessKey || !assumedRole?.sessionToken) {
                    throw new Error('Failed to get valid credentials from assumed role');
                }
                profilecredentials = {
                    accessKeyId: assumedRole.accessKeyId,
                    secretAccessKey: assumedRole.secretAccessKey,
                    sessionToken: assumedRole.sessionToken
                };
            } else {
                profilecredentials = fromIni({ profile: 'default' });
            }

            // Create custom HTTPS agent
            const httpsAgent = new https.Agent({
                keepAlive: true,
                maxSockets: 50,
                rejectUnauthorized: true,
                family: 4,
                timeout: 30000
            });

            const s3Client = new S3Client({
                region: "us-west-2",
                maxAttempts: 3,
                requestHandler: new NodeHttpHandler({
                    httpAgent: httpsAgent,
                    httpsAgent: httpsAgent
                }),
                credentials: profilecredentials
            });
            
            const params = {
                Bucket: this.step.first_bucket_name,
                Key: `${this.step.key}${this.step.filename}`,
                Body: fileContent
            };

            const command = new PutObjectCommand(params);
            await s3Client.send(command);
            return true;
        } catch (error) {
            console.error("Error uploading file to S3:", error);
            throw new Error(`Failed to upload file: ${error}`);
        }
    }

    async s3Download(): Promise<string> {
        try {
            // Handle GitLab environment with role assumption
            let profilecredentials;
            const isGitLab = process.env.GITLAB_CI === 'true';
            if (isGitLab) {
                let assumedRole = null;
                if (this.step.access_role) {    
                    assumedRole = await AWS.createAssumeRole(this.step.access_role);
                }
                else {
                    assumedRole = await AWS.createAssumeRole();
                }
                if (!assumedRole?.accessKeyId || !assumedRole?.secretAccessKey || !assumedRole?.sessionToken) {
                    throw new Error('Failed to get valid credentials from assumed role');
                }
                profilecredentials = {
                    accessKeyId: assumedRole.accessKeyId,
                    secretAccessKey: assumedRole.secretAccessKey,
                    sessionToken: assumedRole.sessionToken
                };
            } else {
                profilecredentials = fromIni({ profile: 'default' });
            }

            // Create custom HTTPS agent
            const httpsAgent = new https.Agent({
                keepAlive: true,
                maxSockets: 50,
                rejectUnauthorized: true,
                family: 4,
                timeout: 30000
            });

            const s3Client = new S3Client({
                region: "us-west-2",
                maxAttempts: 3,
                requestHandler: new NodeHttpHandler({
                    httpAgent: httpsAgent,
                    httpsAgent: httpsAgent
                }),
                credentials: profilecredentials
            });

            const params = {
                Bucket: this.step.bucket,
                Key: this.step.key,
            };
            const command = new GetObjectCommand(params);
            const data = await s3Client.send(command);
            console.log(`File downloaded from ${params.Bucket}/${params.Key}`);
            return await data.Body!.transformToString();
        } catch (error) {
            console.error("Error downloading file from S3:", error);
            throw new Error(`Failed to download file: ${error}`);
        }
    }

    async batch(): Promise<void> {
        try {
            // Handle GitLab environment with role assumption
            let profilecredentials;
            const isGitLab = process.env.GITLAB_CI === 'true';
            if (isGitLab) {
                let assumedRole = null;
                if (this.step.access_role) {    
                    assumedRole = await AWS.createAssumeRole(this.step.access_role);
                }
                else {
                    assumedRole = await AWS.createAssumeRole();
                }
                if (!assumedRole?.accessKeyId || !assumedRole?.secretAccessKey || !assumedRole?.sessionToken) {
                    throw new Error('Failed to get valid credentials from assumed role');
                }
                profilecredentials = {
                    accessKeyId: assumedRole.accessKeyId,
                    secretAccessKey: assumedRole.secretAccessKey,
                    sessionToken: assumedRole.sessionToken
                };
            } else {
                profilecredentials = fromIni({ profile: 'default' });
            }

            // Create custom HTTPS agent
            const httpsAgent = new https.Agent({
                keepAlive: true,
                maxSockets: 50,
                rejectUnauthorized: true,
                family: 4,
                timeout: 30000
            });

            const batchClient = new BatchClient({
                region: "us-west-2",
                maxAttempts: 3,
                requestHandler: new NodeHttpHandler({
                    httpAgent: httpsAgent,
                    httpsAgent: httpsAgent
                }),
                credentials: profilecredentials
            });

            const jobParams = {
                jobName: this.step.job_name,
                jobQueue: this.step.job_queue,
                jobDefinition: this.step.job_definition,
                containerOverrides: this.step.command ? {
                    command: this.step.command
                } : undefined
            };
            console.log('jobParams', jobParams);
            // Submit the job
            const submitResponse = await batchClient.send(new SubmitJobCommand(jobParams));
            const jobId = submitResponse.jobId;
            console.log(`Batch job submitted: ${jobParams.jobName} with ID: ${jobId}`);

            // Monitor job status
            const waitTime = this.step.waitTime || 90; // Default 90 seconds timeout
            const runnableStates = ['SUBMITTED', 'RUNNABLE'];
            const runningStates = ['STARTED', 'RUNNING'];
            const expectedStatus = this.step.status || 'SUCCEEDED';

            let spinner = 0;
            while (true) {
                const describeJobsCommand = new DescribeJobsCommand({ jobs: [jobId!] });
                const describeResponse = await batchClient.send(describeJobsCommand);
                const status = describeResponse.jobs?.[0]?.status;

                console.log(`Job [${jobParams.jobName} - ${jobId}] ${status}`);

                if (status === 'SUCCEEDED' || status === 'FAILED' || spinner > waitTime) {
                    if (runnableStates.includes(status!)) {
                        await batchClient.send(new CancelJobCommand({
                            jobId: jobId,
                            reason: 'Cancelling job due to timeout'
                        }));
                    } else if (runningStates.includes(status!)) {
                        await batchClient.send(new TerminateJobCommand({
                            jobId: jobId,
                            reason: 'Terminating job due to timeout'
                        }));
                    }
                    
                    if (status !== expectedStatus) {
                        throw new Error(`Job ${jobId} status is not as expected. Current status is ${status}`);
                    }
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                spinner++;
            }
        } catch (error) {
            console.error("Error with batch job:", error);
            throw error;
        }
    }

    static async fetchSecretsUsingSecretManager(secretName: string, accessRole?: string): Promise<any> {
        try {
            // Create custom HTTPS agent
            const httpsAgent = new https.Agent({
                keepAlive: true,
                maxSockets: 50,
                rejectUnauthorized: true,
                family: 4,
                timeout: 30000
            });
            let profilecredentials;
            const isGitLab = process.env.GITLAB_CI === 'true';
            if (isGitLab) {
                const assumedRole = await this.createAssumeRole(accessRole);
                if (!assumedRole?.accessKeyId || !assumedRole?.secretAccessKey || !assumedRole?.sessionToken) {
                    throw new Error('Failed to get valid credentials from assumed role');
                }
                profilecredentials = {
                    accessKeyId: assumedRole.accessKeyId,
                    secretAccessKey: assumedRole.secretAccessKey,
                    sessionToken: assumedRole.sessionToken
                };
            } else {
                profilecredentials = fromIni({ profile: 'default' });
            }
    

            const secretsManagerClient = new SecretsManagerClient({
                region: "us-west-2",
                maxAttempts: 3,
                requestHandler: new NodeHttpHandler({
                    httpAgent: httpsAgent,
                    httpsAgent: httpsAgent
                }),
                credentials: profilecredentials,
                endpoint: 'https://secretsmanager.us-west-2.amazonaws.com'
            });
            if (secretName === '') 
                secretName = 'test/urf-db-credentials';   

            const command = new GetSecretValueCommand({ SecretId: secretName });
            const response = await secretsManagerClient.send(command);
            return JSON.parse(response.SecretString || '{}');
        } catch (error) {
            console.error('Error fetching secrets:', error);
            throw error;
        }
    }

    async callLambda(): Promise<void> {
        try {
            // Wait for 5 seconds as in Python implementation
            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('Lambda parameters:', this.step);

            const params = {
                FunctionName: this.step.function_name,
                InvocationType: this.step.invocation_type || 'RequestResponse',
                Payload: JSON.stringify(this.step.payload || {})
            };

            const command = new InvokeCommand(params);
            const response = await this.lambdaClient.send(command);

            if (response.$metadata.httpStatusCode !== 200) {
                throw new Error('Lambda was not triggered successfully');
            }

            // If the lambda function returned an error, throw it
            if (response.FunctionError) {
                const errorPayload = JSON.parse(new TextDecoder().decode(response.Payload));
                throw new Error(`Lambda execution failed: ${errorPayload.errorMessage}`);
            }

            // Parse and return the response payload if needed
            if (response.Payload) {
                const result = JSON.parse(new TextDecoder().decode(response.Payload));
                console.log('Lambda response:', result);
                return result;
            }

        } catch (error) {
            console.error('Error executing Lambda function:', error);
            throw error;
        }
    }

    async sendSQS(): Promise<void> {
        try {
            // Get queue URL
            const getQueueUrlCommand = new GetQueueUrlCommand({
                QueueName: this.step.queue_name
            });
            const queueUrlResponse = await this.sqsClient.send(getQueueUrlCommand);
            const queueUrl = queueUrlResponse.QueueUrl;

            if (!queueUrl) {
                throw new Error('Failed to get queue URL');
            }

            // Send messages
            for (const message of this.step.messages) {
                const sendMessageCommand = new SendMessageCommand({
                    QueueUrl: queueUrl,
                    MessageBody: String(message)
                });

                const response = await this.sqsClient.send(sendMessageCommand);
                
                if (response.$metadata.httpStatusCode !== 200) {
                    throw new Error('Messages are not sent to SQS Queue');
                }
            }

            console.log(`Successfully sent ${this.step.messages.length} messages to queue ${this.step.queue_name}`);
        } catch (error) {
            console.error('Error sending messages to SQS:', error);
            throw error;
        }
    }

    async receiveSQS(): Promise<string[]> {
        try {
            // Get queue URL
            const getQueueUrlCommand = new GetQueueUrlCommand({
                QueueName: this.step.queue_name
            });
            const queueUrlResponse = await this.sqsClient.send(getQueueUrlCommand);
            const queueUrl = queueUrlResponse.QueueUrl;

            if (!queueUrl) {
                throw new Error('Failed to get queue URL');
            }

            // Receive messages
            const receiveMessageCommand = new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: this.step.max_message_count || 10,
                WaitTimeSeconds: 20 // Long polling
            });

            const response = await this.sqsClient.send(receiveMessageCommand);
            
            const messages = response.Messages || [];
            const messageBodies = messages.map(message => message.Body || '');

            console.log(`Received ${messageBodies.length} messages from queue ${this.step.queue_name}`);
            
            return messageBodies;
        } catch (error) {
            console.error('Error receiving messages from SQS:', error);
            throw error;
        }
    }

    async athena(): Promise<any> {
        try {
            const params = {
                QueryString: this.step.query,
                QueryExecutionContext: {
                    Database: this.step.database || "default"
                },
                ResultConfiguration: {
                    OutputLocation: `s3://${this.step.bucket}`
                }
            };

            // Start query execution
            const startQueryCommand = new StartQueryExecutionCommand(params);
            const queryExecution = await this.athenaClient.send(startQueryCommand);
            const queryExecutionId = queryExecution.QueryExecutionId;

            if (!this.step.wait) {
                console.log("Not waiting for query completion, returning execution ID");
                return queryExecutionId;
            }

            // Monitor query execution
            let iterations = 1800; // 30 minutes timeout
            while (iterations > 0) {
                iterations--;
                
                const getQueryCommand = new GetQueryExecutionCommand({
                    QueryExecutionId: queryExecutionId
                });
                const queryDetails = await this.athenaClient.send(getQueryCommand);
                const status = queryDetails.QueryExecution?.Status?.State;

                if (status === 'FAILED' || status === 'CANCELLED') {
                    console.log("Query Status:", status);
                    return false;
                } else if (status === 'SUCCEEDED') {
                    console.log("Query Status Succeeded:", status);
                    
                    // Get query results
                    const getResultsCommand = new GetQueryResultsCommand({
                        QueryExecutionId: queryExecutionId
                    });
                    const queryResult = await this.athenaClient.send(getResultsCommand);
                    
                    if (queryResult.ResultSet?.Rows && queryResult.ResultSet.Rows.length > 1) {
                        const header = queryResult.ResultSet.Rows[0];
                        const rows = queryResult.ResultSet.Rows.slice(1);
                        
                        // Extract header values
                        const headerValues = header.Data?.map(col => col.VarCharValue) || [];
                        
                        // Process rows
                        const result = rows.map(row => {
                            const rowValues = row.Data?.map(col => col.VarCharValue) || [];
                            return Object.fromEntries(headerValues.map((key, i) => [key, rowValues[i]]));
                        });

                        console.log('result-->', result);
                        return result;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between checks
            }
            return false;
        } catch (error) {
            console.error("Error executing Athena query:", error);
            throw error;
        }
    }

    static async getUserFromSecretManager(secretName: string, accessRole?: string): Promise<any> {
        // Use the same configuration as fetchSecretsUsingSecretManager
        return await AWS.fetchSecretsUsingSecretManager(secretName, accessRole);
    }
}

export { AWS, Validator };

class Validator {
    step: any;

    constructor(step: any) {
        this.step = step;
    }

    static validateResponse(step: any, responseId: any): void {
        if ("validate_response" in step) {
            const expectedResponse = step["validate_response"];
            if (expectedResponse === null || expectedResponse === undefined) {
                expect(responseId === null || responseId === undefined, 
                    `Response should be null or undefined but got ${responseId}`).toBeTruthy();
            } else if (Array.isArray(expectedResponse)) {
                Validator.iterateListAssertion(expectedResponse, responseId);
            } else if (typeof expectedResponse === "object") {
                Validator.iterateDictAssertion(expectedResponse, responseId);
            } else {
                expect(String(expectedResponse), `Expected: ${expectedResponse} Actual: ${responseId}`).toEqual(String(responseId));
            }
        }
    }

    static iterateDictValues(stepData: any, paramValues: any): void {
        if (!stepData || typeof stepData !== 'object') {
            return;
        }
        
        for (const [key, value] of Object.entries(stepData)) {
            if (value === null || value === undefined) {
                continue;
            }
            if (typeof value === "string") {
                // Replace placeholders
                stepData[key] = Validator.replacePlaceholders(value, paramValues);
                // Handle increment
                if (value.includes("increment")) {
                    stepData[key] = parseInt(value.replace('increment', '').slice(1, -1)) + 1;
                }
            } else if (typeof value === "object") {
                if (Array.isArray(value)) {
                    Validator.iterateListValues(value, paramValues);
                } else {
                    Validator.iterateDictValues(value, paramValues);
                }
            }
        }
    }

    static iterateListValues(stepData: any[], paramValues: any): void {
        stepData.forEach((value, i) => {
            if (typeof value === "string") {
                stepData[i] = Validator.replacePlaceholders(value, paramValues);
                if (value.includes("increment")) {
                    stepData[i] = parseInt(paramValues[value.replace("increment", "").slice(1, -1)]) + 1;
                }
            } else if (typeof value === "object") {
                if (Array.isArray(value)) {
                    Validator.iterateListValues(value, paramValues);
                } else {
                    Validator.iterateDictValues(value, paramValues);
                }
            }
        });
    }

    static iterateDictAssertion(expected: any, actual: any): void {
        for (const key of Object.keys(expected)) {
            if (Array.isArray(expected[key])) {
                Validator.iterateListAssertion(expected[key], actual[key]);
            } else if (typeof expected[key] === "object") {
                Validator.iterateDictAssertion(expected[key], actual[key]);
            } else {
                expect(String(actual[key]),
                    `Key: ${key} Expected: ${expected[key]} Actual: ${actual[key]}`
                ).toEqual(String(expected[key]));
            }
        }
    }

    static iterateListAssertion(expected: any[], actual: any[]): void {
        expected.forEach((item, i) => {
            if (Array.isArray(item)) {
                Validator.iterateListAssertion(item, actual[i]);
            } else if (typeof item === "object") {
                Validator.iterateDictAssertion(item, actual[i]);
            } else {
                expect(String(actual[i]),
                    `Expected: ${item} Actual: ${actual[i]}`
                ).toBe(String(item));
            }
        });
    }

    static storeResponseValues(valueStore: any, step: any, responseId: any): void {
        try {
            let responseValues = JSON.parse(JSON.stringify(responseId)); // Deep copy
            const expectedStepFields = step["value_map"];

            if (Array.isArray(responseValues)) {
                responseValues = responseValues[0] ?? null;
            }
            if (typeof expectedStepFields === "object") {
                Object.entries(expectedStepFields).forEach(([param, path]) => {
                    let value = responseValues;
                    if (typeof path === 'string') {
                        // Check if path contains type conversion
                        const [actualPath, type] = path.split('|');
                        actualPath.split("/").forEach((segment) => {
                            if (segment.includes('[') && segment.includes(']')) {
                                const [arrayKey, index] = segment.split(/[\[\]]/).filter(Boolean);
                                value = value?.[arrayKey]?.[parseInt(index, 10)];
                            } else {
                                value = value?.[segment];
                            }
                        });
                      
                        // Apply type conversion if specified
                        if (type === 'int') {
                            value = parseInt(value);
                        }
                    }
                   
                    valueStore[param] = value;
                });
            } else if (Array.isArray(expectedStepFields)) {
                expectedStepFields.forEach(param => {
                    valueStore[param] = responseValues?.[param];
                });
            }
        } catch (error) {
            console.error(`Error: ${error}`);
        }
    }

    static validateJson(response: AxiosResponse): any {
        try {
            return response.data;
        } catch (error) {
            return response.data?.toString() || response.statusText;
        }
    }

    static replacePlaceholders(value: string, paramValues: any): string {
        const placeholderPattern = /<<(.+?)>>/g;

        if (value.startsWith("<<") && value.endsWith(">>")) {
            return paramValues[value.slice(2, -2)];
        }
        else
        {
            return value.replace(placeholderPattern, (_, match) => paramValues[match] || "");
        }
    }
}

class KafkaHandler {
    topic: string | null;
    event: any;
    kafka: Kafka;
    groupId: string;

    constructor(step: any) {
        this.topic = step.topic || null;
        this.event = step.event || null;
        this.groupId = step.group_id || 'automation-consumer-group';
        
        this.kafka = new Kafka({
            clientId: 'automation-consumer',
            brokers: [
                'b-1.testkafkacontentcluste.yr0j9p.c2.kafka.us-west-2.amazonaws.com:9094',
                'b-2.testkafkacontentcluste.yr0j9p.c2.kafka.us-west-2.amazonaws.com:9094',
                'b-3.testkafkacontentcluste.yr0j9p.c2.kafka.us-west-2.amazonaws.com:9094'
            ],
            ssl: {
                rejectUnauthorized: true,
                ca: Array.from(ssl.rootCertificates),
                cert: process.env.KAFKA_CLIENT_CERT || '',
                key: process.env.KAFKA_CLIENT_KEY || '',
                passphrase: process.env.KAFKA_CLIENT_CERT_PASSPHRASE || ''
            },
            sasl: process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD ? {
                mechanism: 'plain',
                username: process.env.KAFKA_USERNAME,
                password: process.env.KAFKA_PASSWORD
            } : undefined,
            logLevel: logLevel.ERROR
        });
    }

    async send_event(): Promise<void> {
        try {
            const producer = this.kafka.producer();
            await producer.connect();

            await producer.send({
                topic: this.topic!,
                messages: [
                    { 
                        value: JSON.stringify(this.event)
                    }
                ],
            });

            await producer.disconnect();
            console.log(`Event sent to topic ${this.topic}`);
        } catch (error) {
            console.error('Error sending Kafka event:', error);
            throw error;
        }
    }

    async read_event(): Promise<any> {
        let consumer: Consumer | undefined = this.kafka.consumer({ 
            groupId: this.groupId,
            sessionTimeout: 30000,
            heartbeatInterval: 5000,
            maxWaitTimeInMs: 10000,
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });
        
        try {
            await consumer.connect();
            console.log('consumer connected');
            await consumer.subscribe({ topic: this.topic!});
            console.log('consumer subscribed');
            const filterCriteria = this.event || {};
            let runPromise: any;

            const result = await Promise.race([
                new Promise((resolve, reject) => {
                    runPromise = consumer!.run({
                        eachMessage: async ({ message }: EachMessagePayload) => {
                            try {
                                const eventDetails = JSON.parse(message.value!.toString());
                                console.log('eventDetails', eventDetails);
                                console.log('filterCriteria', filterCriteria);
                                
                                const isMatch = Object.entries(filterCriteria).every(([key, value]) => {
                                    return this.deepMatch(eventDetails, key, value);
                                });
                                console.log("isMatch", isMatch);
                                
                                if (Object.keys(filterCriteria).length === 0 || isMatch) {
                                    resolve(eventDetails);
                                }
                            } catch (error) {
                                reject(error);
                            }
                        },
                    });
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for message')), 60000))
            ]);

            // Cleanup
            if (runPromise && consumer) {
                await consumer.stop();
            }
            if (consumer) {
                await consumer.disconnect();
            }
            consumer = undefined;
            
            return result;
        } catch (error) {
            if (consumer) {
                try {
                    await consumer.stop();
                    await consumer.disconnect();
                } catch (cleanupError) {
                    console.error('Error during cleanup:', cleanupError);
                }
                consumer = undefined;
            }
            throw error;
        }
    }

    // Helper method to deep match nested properties
    private deepMatch(obj: any, path: string, value: any): boolean {
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current === undefined || current === null) {
                return false;
            }
            current = current[part];
        }
        
        return current === value;
    }
}


