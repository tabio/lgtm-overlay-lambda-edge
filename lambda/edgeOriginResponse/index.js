"use strict";

// NOTE: このLambdaはバージニアにデプロイされるが、ログは東京に出力される

// origin responseの説明
// ref. https://aws.amazon.com/jp/blogs/news/resizing-images-with-amazon-cloudfront-lambdaedge-aws-cdn-blog/

const {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const Sharp = require("sharp");
const BUCKET = "example-bucket";

exports.handler = async (event, context, callback) => {
  let response = event.Records[0].cf.response;

  // OriginaResponseはOriginであるS3側にファイルがあったかどうかを判断してその結果をStatus Codeで返す
  if (response.status === 200 || response.status === "200") {
    callback(null, response);
    return;
  }

  // overlay画像を生成する
  let request = event.Records[0].cf.request;

  // ex.) /team-name/images/small/hoge.png
  let path = request.uri;

  const match = path.match(/(.*)\/(.*)\/(.*)\.(.*)/);
  const overlayType = match[2];
  const requiredFormat = match[4] == ("jpg" || "jpeg") ? "jpeg" : match[4]; // sharpがjpgだと動かないのでjpegに変換

  // 新たにS3に保存するためのキー
  const key = path.substring(1);

  // オリジナル画像のキー
  let pattern = new RegExp(`\/${overlayType}`);
  let originalKey = key.replace(pattern, "");

  try {
    const client = new S3Client({ region: "ap-northeast-1" });
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: originalKey,
    });
    const getObjectOutput = await client.send(getCommand);
    const bytes = await getObjectOutput.Body?.transformToByteArray();
    const image = await Sharp(bytes);
    const metadata = await image.metadata();

    let fontSize;
    if (overlayType === "small") {
      fontSize = 30;
    } else if (overlayType == "medium") {
      fontSize = 70;
    } else {
      fontSize = 110;
    }

    const overlayImage = Buffer.from(
      `<svg width="${metadata.width}" height="${metadata.height}">
        <defs>
          <filter id="drop-shadow" x="-20%" y="-20%" width="150%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
            <feOffset dx="4" dy="4" result="offsetblur" />
            <feFlood flood-color="black" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>
          .title {
            font-size: ${fontSize}px;
            font-weight: bold;
            fill: #ffffff;
            filter: url(#drop-shadow);
          }
        </style>
        <text x="50%" y="50%" text-anchor="middle" class="title">LGTM</text>
      </svg>`
    );

    const buffer = await image
      .composite([{
        input: overlayImage,
      }])
      .toFormat(requiredFormat)
      .toBuffer();

    // s3に保存
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
    });
    await client.send(putCommand);

    // クエリに返却するレスポンスを再設定
    response.status = 200;
    response.body = buffer.toString("base64");
    response.bodyEncoding = "base64";
    response.headers["content-type"] = [
      { key: "Content-Type", value: "image/" + requiredFormat },
    ];

    callback(null, response);
  } catch (err) {
    console.error(err);
  }
};
