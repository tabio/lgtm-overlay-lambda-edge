// CloudFront Functionsの制約
// 1ms以下で処理が終わる必要がある
// 環境変数は使えない
// let, const は慎重に var に置き換える
// 起動する関数名は hanlder() 固定
// event.request 構造を return すると後続に継続する

function handler(event) {
  // ex. /yabusame/hoge.png?overlay={small or medium or large}
  var request = event.request;
  var querystring = request.querystring;
  var overlay = querystring.overlay;

  // overlay用パラメーターが存在しない場合はオリジナル画像のリクエストとして判断
  if (overlay.value === undefined) {
    return request;
  }

  var fwdUri = request.uri;
  var match = fwdUri.match(/(.*)\/(.*)\.(.*)/);
  var prefix = match[1];
  var imageName = match[2];
  var extension = match[3];

  var url = [];
  url.push(prefix);
  url.push(overlay.value);
  url.push(imageName + "." + extension);
  fwdUri = url.join("/");

  // CloudFrontのキャッシュに対して、問い合わせするURI(加工済みの画像のパス）に書き換え
  // ex. /yabusame/small/hoge.png
  request.uri = fwdUri;

  return request;
}
