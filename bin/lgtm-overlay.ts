#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LgtmOverlayStack } from "../lib/lgtm-overlay-stack";

const app = new cdk.App();
new LgtmOverlayStack(app, "LgtmOverlayStack", { env: { region: "ap-northeast-1" } });
