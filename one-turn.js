/**
 * 简单的一轮工具调用的对话Demo，用户提问，调用add函数计算1+1的值，并将结果返回给用户
 */
const toolUseMap = {
  add:(...nums) => {
    return nums.reduce((a, b) => a + b, 0);
  }
}


const tools = [{
  name:'add',
  description:`加法工具，接受不定长参数，返回他们的和。注意参数必须是数字类型
  函数签名支持两种调用方式：
    - add(1, 2, 3, 4)      // 不定长参数
    - add([1, 2, 3, 4])    // 传入数组
    通过 Tool Use 调用时，请将所有数字放入 nums 数组。
  `,
  input_schema:{
    type:'object',
    properties:{
      nums:{
        type:"array",
        items:{
          type:"number",
        }
      }
    }
  },
  input_example:[
    {
      nums:[1,2,3]
    },
    {
      nums:[]
    },
  ]
}]



export default async (client, MODEL_NAME) => {
const response = await client?.messages?.create?.({
  model: MODEL_NAME,
  tools,
  max_tokens:4000,
  messages:[
    {
      role:'user',
      content:'帮我计算一下1 + 1的值'
    }
  ]
}) ?? {}
const {type = '', id:tool_use_id = '', input = {}, name = ''} = response?.content?.[response?.content?.length - 1] ?? {};
if(type === 'tool_use') {
  let result = '';
  const toolFunc = toolUseMap?.[name];
  let isError = false;
  if(typeof toolFunc === 'function') {
    try {
      result = toolFunc?.(...input?.nums)?.toString?.() ?? "";
    }
    catch(err) {
      isError = true;
      result = err?.message ?? '工具调用失败'
    }
    //拿到结果后继续消息对话，注意需要补全之前一次对话的消息记录。
    const messages = [
      {
      role:'user',
      content:'帮我计算一下1 + 1的值'
    },
      {
        role:'assistant',
        content:response?.content,
      },
      {
          role:'user',
          content:[
            {
              type:'tool_result',
              content:result,
              tool_use_id,
              is_error:isError,
            }
          ]
      }
    ]
    console.log('messages is ', JSON.stringify(messages))
    const response_2 = await client?.messages.create({
      model: MODEL_NAME,
      tools,
      max_tokens:4000,
      messages,
    })
    console.log('response is ', response_2)
  }
}
}