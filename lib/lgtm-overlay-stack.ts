import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

const bucketName = "example-bucket";

export class LgtmOverlayStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // s3 bucket
    const bucket = new cdk.aws_s3.Bucket(this, bucketName, {
      bucketName: bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // cloudfrontにLambda@Edgeを設定
    // cloudfront.experimental.EdgeFunctionがnodejsfunctionに対応していないのでTypeScriptで書けない
    // CloudFront Functionsに置き換えることでコスト下げられる（一方で制約もできる）
    const lambdaEdgeViewerRequest = new cdk.aws_cloudfront.experimental.EdgeFunction(
      this,
      "LgtmOverlayLambdaEdgeViewerRequest",
      {
        code: cdk.aws_lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/edgeViewerRequest"),
        ),
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        timeout: cdk.Duration.seconds(5),
        memorySize: 128,
        architecture: cdk.aws_lambda.Architecture.X86_64, // Lambda@Edgeはarm対応していないため
      },
    );

    // sharpがlambdaで利用できるように
    const originResponseCommand = [
      "bash",
      "-c",
      [
        "cp index.js /asset-output",
        "cd /asset-output",
        "npm install querystring --omit=dev --prefix .",
        "npm install @aws-sdk/client-s3 --omit=dev --prefix .",
        // 利用環境によって異なるので、ドキュメントを参照して調整(https://sharp.pixelplumbing.com/install#aws-lambda)
        "npm install sharp --arch=x64 --platform=linux --omit=dev --prefix .",
        // "npm install --platform=darwin --arch=arm64 sharp --omit=dev --prefix ."
      ].join(" && "),
    ];

    const lambdaEdgeOriginResponse = new cdk.aws_cloudfront.experimental.EdgeFunction(
      this,
      "LgtmOverlayLambdaEdgeOriginResponse",
      {
        code: cdk.aws_lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/edgeOriginResponse"),
          {
            bundling: {
              image: cdk.aws_lambda.Runtime.NODEJS_18_X.bundlingImage,
              command: originResponseCommand,
              user: "root",
            },
          },
        ),
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        timeout: cdk.Duration.seconds(20),
        memorySize: 512,
        architecture: cdk.aws_lambda.Architecture.X86_64, // Lambda@Edgeはarm対応していないため
      },
    );

    // s3に対して、CloudFrontのOriginとして設定
    const distribution = new cdk.aws_cloudfront.Distribution(
      this,
      "LgtmOverlayDistribution",
      {
        defaultBehavior: {
          origin: new cdk.aws_cloudfront_origins.S3Origin(bucket),
          viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          edgeLambdas: [
            {
              eventType: cdk.aws_cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
              functionVersion: lambdaEdgeViewerRequest.currentVersion,
            },
            {
              eventType: cdk.aws_cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE,
              functionVersion: lambdaEdgeOriginResponse.currentVersion,
            },
          ],
        },
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
        enableIpv6: false,
      },
    );

    new cdk.aws_s3_deployment.BucketDeployment(this, "LgtmOverlayDeployment", {
      sources: [
        cdk.aws_s3_deployment.Source.data(
          "/index.html",
          "<html><body><h1>Hello World</h1></body></html>",
        ),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
    });

    const oai = new cdk.aws_cloudfront.OriginAccessIdentity(this, "LgtmOverlayOAI", {
      comment: "LgtmOverlayOAI",
    });

    bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["s3:GetObject"],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: [`${bucket.bucketArn}/*`],
        principals: [
          new cdk.aws_iam.CanonicalUserPrincipal(
            oai.cloudFrontOriginAccessIdentityS3CanonicalUserId,
          ),
        ],
      }),
    );
  }
}
