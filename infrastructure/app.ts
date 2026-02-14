#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AvvarIStack } from './stacks/avvari-stack';

const app = new cdk.App();

// Get environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Create the main stack
new AvvarIStack(app, 'AvvarIForBharatStack', {
  env: {
    account,
    region,
  },
  description: 'AvvarI for Bharat - AI-Powered Heritage Site Digitization Platform',
  tags: {
    Project: 'AvvarI-for-Bharat',
    Environment: process.env.ENVIRONMENT || 'development',
    Owner: 'AvvarI-Team',
  },
});

app.synth();