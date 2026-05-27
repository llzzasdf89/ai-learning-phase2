import Anthropic from "@anthropic-ai/sdk";
import oneTurnToolUseCase from './one-turn.js';// 一轮对话和工具调用的Demo
import agenticLoopToolUseCase from './agentic-loop.js'; //循环对话一次调用的Demo
import multipleToolsParallelCalls from './multiple_tools_parallel_calls.js'; //循环对话和多次并行调用的Demo
import handleErrorUseCase from './handle-error.js'; //工具调用报错的Demo
// import toolRunnerUseCase from './tool-runner.js'; //Anthropic封装的工具调用函数SDK的Demo
const API_KEY = "xxx"
const MODEL_NAME = 'xxx'
const client = new Anthropic({
    baseURL: "https://dashscope.aliyuncs.com/apps/anthropic",
    apiKey:API_KEY,
})
// const oneTurnToolUseCase = require('./one-turn.js');
// oneTurnToolUseCase(client,MODEL_NAME);
// agenticLoopToolUseCase(client,MODEL_NAME);
// multipleToolsParallelCalls(client,MODEL_NAME);
// handleErrorUseCase(client,MODEL_NAME);
// toolRunnerUseCase(client,MODEL_NAME);