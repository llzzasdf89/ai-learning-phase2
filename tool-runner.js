/**
 * 这个例子将展示Anthropic所封装的tool-runner 这个SDK的使用方法。
 * tool-runner本质上所做的工作，其实和前面的几个章节，包含agentic-loop,multiple_tools_parallel_calls.js,handle-error.js是一样的：他们本质上就是一个循环，检查模型的回复中是否包含工具调用，如果包含工具调用，就执行工具函数，并将结果返回给模型，直到模型不再调用工具为止。
 * 同时，我们在handle-error例子中，也看到了工具函数执行的错误场景是如何处理的。
 * tool-runner其实你可以理解为就是将agentic-loop，handle-error以及multiple_tools_paralllel_calls这三个例子中的所有代码结合了一下，封装成了一个工具函数，方便开发者调用。
 */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
export default async (client,MODEL_NAME) => {
    //betaZodTool用来定义工具，zod用来书写schema
    /**
     * 下面betaZodTool定义的函数，跟我们在前面的章节手动书写的定义是一样的
     * {
            name:'add',
            description:'一个简单的加法函数，输入一些数字，输出它们的和',
            input_schema:{
                type:'object',
                properties:{
                    nums:{
                        type:'array',
                        items:{
                            type:'number'
                        }
                    }
                }
            }
        },

        function add(...nums) {
            return nums.reduce((a, b) => a + b, 0);
        }
     */
    const addEvent = betaZodTool({
        name:'add', //工具名称
        description:'一个简单的加法函数，输入一些数字，输出它们的和',
        inputSchema:z.object({
            nums:z.array(z.number())
        }),//工具的Schema
        //等同于这个工具的真正执行函数
        run:(...nums) => {
            return nums.reduce((a, b) => a + b, 0);
        }
    })
    const divideEvent = betaZodTool({
        name:'divide', //工具名称
        description:'一个简单的除法函数，输入被除数和除数，输出商的整数部分。注意除数不能为零，否则会报错',
        inputSchema:z.object({
            dividend:z.number(),
            divisor:z.number()
        }),//工具的Schema
        //等同于这个工具的真正执行函数
        run:(dividend, divisor) => {
            if (divisor === 0) {
                throw new Error("除数不能为零");
            }
            return Math.floor(dividend / divisor);
        }
    })
    const tools = [addEvent,divideEvent];
    //通过tool-runner调用模型后，我们只需要接收模型最后回复的消息就行了。中间消息处理的过程全部都被封装和省略掉，帮助我们屏蔽了工具调用的细节，让我们专注于业务逻辑本身。
    const finalMessage = await client.beta.messages.toolRunner({
        model:MODEL_NAME,
        max_tokens:4000,
        tools,
        messages:[
            {
                role:'user',
                content:'请你先调用add工具计算一下1,2,3的和，然后再调用divide工具用这个和除以0，最后告诉我结果'
            }
        ]
    })
    for(const block of finalMessage.content) {
        if (block.type === "text") {
            console.log(block.text);
        }
    }
}