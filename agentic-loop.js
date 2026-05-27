/**
 * 实际开发中，工具调用的次数可能不仅仅只有一次，甚至可能有多次。这个例子就很好的使用了循环的方式来实现多轮工具调用的场景。
 * 注意它的结束判断条件，是通过response.stop_reason来完成的。这也是官方推荐的循环开启/结束的标准判断方式
 * 另外，就是在循环中需要不断的将之前的消息记录回推到消息数组中，以保证模型每次调用工具时，都能拿到完整的上下文信息，来正确的判断下一步的动作是什么。注意消息记录的规则，同一个调用id的tool_use和tool_result必须相邻
 */
export default async (client,MODEL_NAME) => {
    const toolUseMap = {
        add(...nums) {
            return nums.reduce((a, b) => a + b, 0);
        }
    }
    const tools = [
        {
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
        }
    ]
    const messages = [
        {
            role:'user',
            content:'请你帮我计算一下1 + 1的值。然后我还想将它的结果拿来加上3，请问最终输出会是多少？'
        }
    ]
    let response = await client?.messages?.create({
        model: MODEL_NAME,
        tools,
        messages,
        max_tokens:4000,
    })
    //关键点：循环判断模型回复的消息是否为工具调用，如果是的话，就执行工具函数，并将结果返回给模型，直到模型不再调用工具为止
    while(response.stop_reason === 'tool_use') {
        const {id:tool_use_id = '', input = {}, name = ''} = response?.content?.[response?.content?.length - 1] ?? {};
        let result = '';
        let is_error = false;
        try {
            if(typeof toolUseMap?.[name] !== 'function') {
                throw Error(`工具函数${name}不存在`);
            }
            result = toolUseMap?.[name]?.(...input?.nums ?? [])?.toString?.() ?? ''; //注意返回结果必须格式化为字符串，否则模型依然会报错
        }
        catch(err) {
            result = '工具函数执行出错，错误信息： ' + err?.message ?? '';
            is_error = true;
        }
        //将模型的消息记录回推到消息数组
        messages.push({
            role:'assistant',
            content:response.content,
        })
        //将工具的调用结果回推到消息数组
        messages.push({
            role:'user',
            content:[
                {
                    type:'tool_result',
                    tool_use_id,
                    content:result,
                    is_error
                }
            ]
        })
        //重新赋值response，保持response更新
        response = await client?.messages?.create({
            model:MODEL_NAME,
            tools,
            messages,
            max_tokens:4000,
        })
    }
    console.log('response is ', response)
    //打印输出模型调用回复内容
    for (const block of response.content) {
        if (block.type === "text") {
            console.log(block.text);
        }
}
}
