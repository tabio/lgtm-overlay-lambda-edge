"use strict";

// NOTE: このLambdaはバージニアにデプロイされるが、ログは東京に出力される

// viewer requestの説明
// ref. https://aws.amazon.com/jp/blogs/news/resizing-images-with-amazon-cloudfront-lambdaedge-aws-cdn-blog/
const querystring = require("querystring");

exports.handler = (event, context, callback) => {
  // ex. /team_name/images/hoge.png?overlay={small or medium or large}
  const request = event.Records[0].cf.request;

  const params = querystring.parse(request.querystring);
  let fwdUri = request.uri;
  const overlay = params.overlay;

  // overlay用パラメーターが存在しない場合はオリジナル画像のリクエストとして判断
  if (!overlay) {
    callback(null, request);
    return;
  }

  const match = fwdUri.match(/(.*)\/(.*)\.(.*)/);
  let prefix = match[1];
  let imageName = match[2];
  let extension = match[3];

  let url = [];
  url.push(prefix);
  url.push(overlay);
  url.push(imageName + "." + extension);
  fwdUri = url.join("/");

  // CloudFrontのキャッシュに対して、問い合わせするURI(加工済みの画像のパス）に書き換え
  // ex. /team_name/images/small/hoge.png
  request.uri = fwdUri;

  callback(null, request);
};
