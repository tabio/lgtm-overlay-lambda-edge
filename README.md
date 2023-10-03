# 概要

S3にアップロードした画像にパラメーター付きでアクセスすると、LGTMが差し込まれた画像に変換してくれる

画像変換にはLambda@Edgeを利用している

# 手順

1. 画像をS3にアップロードする
1. CloudFront経由でS3にアクセスする(URLは以下)
    - https://xxx.cloudfront.net/test/images/hoge.png?overlay=small
    - https://xxx.cloudfront.net/test/images/hoge.png?overlay=medium
    - https://xxx.cloudfront.net/test/images/hoge.png?overlay=large
1. 画像がS3にあればLGTMを差し込んだ画像を生成してブラウザに返却する
    - Lambda@EdgeのViewerが既に変換された画像があれば返却する
    - まだ変換した画像がなければLambda@EdgeのOriginに流して、画像変換しS3に保存する