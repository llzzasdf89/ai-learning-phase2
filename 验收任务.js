/**
 * 给你的 Agent 三个工具：
  - read_file(path)：读取文件内容
  - write_file(path, content)：写入文件内容
  - list_files(directory)：列出目录下的文件名

  在当前目录下新建几个txt文件，内容随意，名字长度不一样。程序运行后看是否输出了output.txt文件，内容是名字最短的txt文件的内容的大写版本。


然后对它说这句话：
"帮我列出当前目录的文件，读取其中名字最短的那个文件，
把它的内容全部转换成大写，写入一个叫 output.txt 的新文件。"

这个任务要求模型自己做三步决策（list → read → write），中间需要记住上下文（第一步的结果决定第二步读哪个文件），最后有一个明确的终点。
如果这个任务跑通了，第二阶段的里程碑就达到了。
 */

import Anthropic from "@anthropic-ai/sdk";
const API_KEY = "sk-1fae8b198b114399b097b74f0114586e"
import fs from 'fs';
const MODEL_NAME = 'qwen-plus-2025-07-28'
const client = new Anthropic({
    baseURL: "https://dashscope.aliyuncs.com/apps/anthropic",
    apiKey:API_KEY,
})
const toolMap = {
    read_file:({path = ''}) => fs.readFileSync(path,'utf-8')?.toString?.(),
    write_file:({path = '', content = ''}) => fs.writeFileSync(path,content,'utf-8') === undefined ? '写入成功' : '写入失败',
    list_files:({directory = ''}) => fs.globSync(directory + "**.txt")?.join?.('\n') ?? '',
}

const tools = [
    {
        name:'read_file',
        description:'读取文件内容，参数是文件路径，返回值是文件内容（字符串）',
        input_schema:{
            type:'object',
            properties:{
                path:{
                    type:'string',
                    description:'文件路径'
                }
            },
            required:['path']
        }
    },
    {
        name:'write_file',
        description:'写入文件内容，参数是文件路径和要写入的内容（字符串）',
        input_schema:{
            type:"object",
            properties:{
                path:{
                    type:'string',
                    description:'文件路径'
                },
                content:{
                    type:'string',
                    description:'要写入的内容'
                }
            },
            required:['path', 'content']
        }
    },
    {
        name:'list_files',
        description:'列出目录下的所有的txt文件名，参数是目录路径，返回值是文件名列表',
        input_schema:{
            type:'object',
            properties:{
                directory:{
                    type:'string',
                    description:'目录路径'
                }
            },
            required:['directory']
        },
    }
]

const messages = [
    {
            role:'user',
            content:"帮我列出当前目录的文件，读取其中名字最短的那个文件，把它的内容全部转换成大写，写入一个叫 output.txt 的新文件。"
    }
]
let response = await client.messages.create({
    model:MODEL_NAME,
    messages,
    max_tokens:4000,
    tools,
    temperature:0,
})
while(response.stop_reason === 'tool_use') {
    const tool_results = [];
    response.content?.filter(item => item.type === 'tool_use')?.forEach(block => {
        const {id:tool_use_id = '',name = '', input = ''} = block;
        let result = '';
        let is_error = false;
        try {
            result = toolMap[name]?.({
                ...input,
            }) ?? '';
        }
        catch(err) {
            result = `Error: ${err?.message} in tool ${name}`;
            is_error = true;
        }
        tool_results.push({
            tool_use_id,
            content:result,
            is_error,
            type:'tool_result',
        })
    })
    messages.push({
        role:'assistant',
        content:response.content,
    })
    messages.push({
        role:'user',
        content:tool_results,
    })
    response = await client.messages.create({
        model:MODEL_NAME,
        messages,
        max_tokens:4000,
        tools,
        temperature:0,
    })
}
messages.push({
    role:'assistant',
    content:response.content,
})
for(const block of messages) {
    if(block.role === 'user') {
        console.log('User:', block.content);
    }
    else {
        console.log('Assistant:', block.content);
    }
}