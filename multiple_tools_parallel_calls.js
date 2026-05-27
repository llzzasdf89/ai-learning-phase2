/**
 * 在实际的应用中，往往会存在多个工具agent可以选择调用的情况。这些工具他们相互之间独立，并没有依赖关系。在这种情况下，Claude可能会选择并行调用多个工具来完成用户的请求，以提高效率。这种情况下，多个tool_use消息会一起返回，因此需要开发者自行处理。
 * 下面是一个示例，他实在agentic-loops的基础上完成的。循环体内部做的事情本质上没有什么变化，只是从处理单个tool_use消息变成了批量处理。
 * 工具上增加了乘法
 * 用户提问：我想知道 1 + 1和 2* 3的值分别为多少？
 * 在这个例子中，你可以观察得到，模型同时会生成add工具和multiply工具的调用
 */

export default async(client,MODEL_NAME) => {
    //增加了乘法供模型选择调用
    const toolUseMap = {
        add(...nums) {
            return nums.reduce((a, b) => a + b, 0);
        }, //加法
        multiply(...nums) {
            return nums.reduce((a, b) => a * b, 1);
        } //乘法
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
        },
        {
            name:'multiply',
            description:'一个简单的乘法函数，输入一些数字，输出它们的积',
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
            content:'我想知道 1 + 1和 2* 3的值分别为多少？'
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
        const tool_results = [] //收集所有工具调用的结果，后续一起发送给模型。
        //因为可能存在并行调用，因此模型会在一个消息response中回复多个tool_use消息块，因此我们需要遍历所有的消息块，找到其中的tool_use消息进行处理
        response?.content?.forEach?.(block => {
            const {id:tool_use_id = '', input = {}, name = '', type = ''} = block;
            if(type !== 'tool_use') return; //如果不是工具调用消息块，则跳过
            console.log('模型调用工具：' + name + '，输入参数：' + JSON.stringify(input)); //打印日志，观察模型调用了哪些工具，输入了什么参数
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
            tool_results.push({
                tool_use_id,
                content:result,
                is_error,
                type:'tool_result'
            })
        })
        //将模型的消息记录回推到消息数组
        messages.push({
            role:'assistant',
            content:response.content,
        })
        //将工具的调用结果回推到消息数组
        messages.push({
            role:'user',
            content:tool_results //所有tool_results调用必须统一集中在一个数组中发送回给模型
        })
        //重新赋值response，保持response更新
        response = await client?.messages?.create({
            model:MODEL_NAME,
            tools,
            messages,
            max_tokens:4000,
        })
    }
    //打印输出模型调用回复内容
    for (const block of response.content) {
        if (block.type === "text") {
            console.log('模型回复：' + block.text); 
        }
}
}