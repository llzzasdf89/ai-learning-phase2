## Tool use (工具调用)
### 什么是工具调用？  
工具调用是一种**应用和模型之间的一种协议（合约）**，在这个协议里面，你可以指定**模型可以调用的操作（通常是函数），以及这些操作（函数的）输入，输出**。  
有了这份协议以后，**模型就可以决定调用这些操作的时机还有方式**。  

### 为什么要有工具调用？  
工具调用的存在是为了赋予模型更多的能力，让他**不仅仅再担任一个单纯的文本生成器**。  
比方说，在有了工具调用以后，你可以定义一个查询天气的函数。当你问及明天天气如何的时候，模型就会调用这个函数，查询明天的实况天气后再回答给你。在这个例子中，工具调用赋予了模型查询天气的能力。  
还有些场景，比方说你问到模型这个商品价格多少多少，哪些平台折扣更多等等。这些个问题需要联网，那么模型会自动调用联网的操作，去到谷歌，百度等搜索引擎查询比价后返回结果给你。在这个例子中，就是赋予了模型接通互联网搜索的能力。

### 怎么使用工具调用？
以Anthropic的API为例子，一个工具调用要想完成首先得要经过下面几个步骤：  
### 一、定义工具：
一个工具其实对应的就是JS里面的一个对象。这个对象包含下面几个字段
```ts
{
    name:^[a-zA-Z0-9_-]{1,64}$, //工具名称
    description:string, //工具描述
    input_schema:Object<JSON_Schema>, //实现了JSONSchema的对象
    input_examples:Array<Object>, //按照JSON_Schema中key填写的对象数组
}
例如一个天气查询工具定义如下
{
      name: "get_weather",
      description: "Get the current weather in a given location",
      input_schema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA"
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "The unit of temperature"
          }
        },
        required: ["location"]
      },
      input_examples: [
        {
          location: "San Francisco, CA",
          unit: "fahrenheit"
        },
        {
          location: "Tokyo, Japan",
          unit: "celsius"
        },
        {
          location: "New York, NY"
          // 这里没加unit，是因为unit在工具的schema定义中，并不是必须参数。
        }
      ]
}
```  
注意点：  
1. `input_examples`必须是实现了上面input_schema的对象，如果其中有一个例子没有实现的话，那么SDK会报400 error。
2. `input_examples`只能够用于客户端的工具，服务端的工具比如Anthropic提供的web_search等等，都是不会参考这个字段的例子的
3. `input_examples`会增加token的消耗，对于一个简单的例子而言，可能会增加20～50个Token。如果对于复杂的例子，那就有可能是100～200之间。  
4. 某些场景下，你可能想让Claude强制使用你定义的工具，**因为Claude的默认设置是让他自行决定，评判是否需要调用你提供的工具的**。你可以通过`tool_choice`这个选项来完成这个场景。这个值大概有四个选项:  
- auto: 允许Claude自行判断什么时候调用你的工具，这个值也是默认值
- any: 要求Claude必须使用至少一个你所提供的工具，但是并不一定是你想指定的某一个
- tool: 要求Claude使用一个特定的工具
- none: 要求Claude不使用任何工具  
比方说，如果你想强制调用上面例子中天气查询工具的选项，那就可以这么写
```js
anthropic.messages.create({
   ...,
   tool_choice:{
    type:'tool',
    name:'get_weather'
   }
})
```   
5. 此外，工具根据运行环境，大致分为三种类型：  
> *用户定义的工具（User-defined tools）*：运行在客户端环境。这是工具调用中绝大部分使用的类型。  

> *Anthropic本地工具工具(Anthropic-schema tools)*: 运行在客户端环境。例如像`text_editor`, `computer`, `memory`,  `bash`等等。你可能会疑惑这些功能用户好像自行定义，为什么不直接归类于User-defined tools类目里面？原因是因为这类型的工具都是经过Anthropic训练模型、测试模型成千上万遍所积累出来的结果。他们对于边界场景和异常处理等情况会更加健壮，换句话说就是比用户自行定义的更可靠。  

> *服务端工具（Server-side tools）*：运行在服务器，例如像`web_search`，`web_fetch`,`code_execution`,`tool_search`等这类型需要打通互联网功能的工具。  


### 二、处理工具调用的响应：  
通常情况下，只要你定义好了工具，那么工具的调用时机是由Claude自行决定的，除非你设置了`tool_choice`这个选项。  
因此，我们就以通常情况为例，当你向Claude发出相关联的问题的提问的时候，Claude是会这样回应的（当然这些敬语或者与用户交互的短语是由Claude根据语境自行生成的，下面的例子仅供参考）
```js
const response = anthropic.messages.create({
    messages:[
        {
            content:'上海天气如何？',
            role:'user'
        },
        {
            role:'assistant',
            content:[
                {
                    type:'text',
                    text:'我将帮助你查询上海当天的天气如何'
                },
                //调用的时候，会生成一个type为tool_use的消息类型，然后这个消息体中会生成一个调用id，以及被调用的工具的名称和输入参数
                {
                    type:'tool_use',
                    id:'xxxxxx',
                    name:'get_weather',
                    input:{
                        location:'上海',
                    }
                }
            ]
        }
    ]
})

console.log(response);
//模型会回复一个tool_use类型的消息，并且在这个消息体中，它的工具调用id以及工具名称和对话开始时请求的id和工具名称是一致的。
{
    id:'xxx',//消息id
    model:'claude-opus-4.7', //模型名称
    stop_reason:'tool_use',
    role:'assistant',
    content:[
        {
            type:'text',
            text:'我将帮助你查询上海当天的天气如何'
        },
        {
            type:"tool_use",
            id:'xxxxxx', //这里会与刚启动对话时候的调用id保持一致
            name:'get_weather',
            input:{
                location:'上海'
            }
        }
    ]
}
```  
紧接着我们收到模型响应的工具调用的信息以后，接下来我们应该干的事情，就是解构这个消息体，**拿到这个工具调用的id以及这次调用的入参**，在我们的代码环境中运行这个对应的工具函数，传递这个入参，收集执行结果。
```js
//假设这个函数就是我们对应的get_weather工具调用所定义的函数
function getWeather({
    location = '',
    unit = ''
}) {
    ...
    return xxx
}

const {input, id, name, type} = response.content[response.content.length - 1]
if(type === 'tool_use') {
    //调用对应的工具函数，传入入参并执行，收集结果
    const result = getWeather({
        ...input
    })
}
```  
然后，我们紧接着发送一条新的用户信息，继续刚才与模型的对话。**这条新的信息必须指定类型为`type:tool_result`，从而将工具调用的结果传回给模型解析**。看下面示例代码
```js
// 在上面的代码块中，我们已经将getWeather这个函数的调用收集到了result变量里，同时也解构了response中的input,id,name,type
anthropic.messages.create({
    role:'user', //必须是用户类型的消息
    content:[{
        type:'tool_result', //声明这条消息是用来传递工具调用的结果的
        tool_use_id:id, //与刚才模型响应的调用id一致
        content:result, //用来传递调用结果。这个选项非必填
        is_error:false //该次调用是否报错，如果是的话设置为true。这个选项非必填
    },
    ...后续紧跟着其他用户消息（如果有的话）
    ]
})
```  
注意：  
1. `tool_result`消息必须紧跟着上一份`tool_use`的消息记录，你不能够在这两个消息记录中插入任何其他的消息。
2. 如果用户的消息数组里面包含了`tool_result`消息的话，那么这条消息必须放在数组第一位。其他的消息必须放在其后面，不然就会报400错误。
怎么理解呢？刚才上面所有的代码块所连接成的消息记录是这样子的
```js
messages = [
    {
         {
            content:'上海天气如何？',
            role:'user'
        },
        {
            role:'assistant',
            content:[
                {
                    type:'text',
                    text:'我将帮助你查询上海当天的天气如何'
                },
                //调用的时候，会生成一个type为tool_use的消息类型，然后这个消息体中会生成一个调用id，以及被调用的工具的名称和输入参数
                {
                    type:'tool_use',
                    id:'xxxxxx',
                    name:'get_weather',
                    input:{
                        location:'上海',
                    }
                }
            ]
        },
        //tool_use消息发出以后，下一条消息必须紧跟着tool_result结果返回的消息。对应刚才提到的规则1.
        {
            role:'user', //必须是用户类型的消息
            content:[{
                type:'tool_result', //声明这条消息是用来传递工具调用的结果的
                tool_use_id:id, //与刚才模型响应的调用id一致
                content:result, //用来传递调用结果
                is_error:false //该次调用是否报错，如果是的话设置为true
            },
            ...后续紧跟着其他用户消息（如果有的话）
            ]
        }
    }
]

下面是错误的形式
messages = [
    {
         {
            content:'上海天气如何？',
            role:'user'
        },
        {
            role:'assistant',
            content:[
                {
                    type:'text',
                    text:'我将帮助你查询上海当天的天气如何'
                },
                //调用的时候，会生成一个type为tool_use的消息类型，然后这个消息体中会生成一个调用id，以及被调用的工具的名称和输入参数
                {
                    type:'tool_use',
                    id:'xxxxxx',
                    name:'get_weather',
                    input:{
                        location:'上海',
                    }
                }
            ]
        },
        {
            role:'user', 
            //报错，原因是因为在tool_use和tool_result之间插入了其他信息。tool_use和tool_result两个信息必须相邻且tool_result紧跟着tool_use。并且包含了tool_use的消息，都必须放在content数组的第一位。
            content:[
                {
                    type:'text',
                    content:'我不想问了，回退'
                },
                {
                type:'tool_result', //声明这条消息是用来传递工具调用的结果的
                tool_use_id:id, //与刚才模型响应的调用id一致
                content:result, //用来传递调用结果
                is_error:false //该次调用是否报错，如果是的话设置为true。
            },
            ...后续紧跟着其他用户消息（如果有的话）
            ]
        }
    }
]
```  
3. tool_result消息体中，传递的内容不一定是文字类型（字符串），也可以传递图片，附件等信息。通过指定source字段
```js
//附件类型
{
    type:'tool_result',
    tool_use_id:id,
    content:[{
        type:'text',
        text:'上海的天气是：'
    },
    {
        type:'document',
        source:{
            type:'text',
            media_type:'text/plain',
            data:'15度'
        }
    }
    ]
    is_error:false
}

//图片类型
{
    type:'tool_result',
    tool_use_id:id,
    content:[{
        type:'text',
        text:'上海的天气是：'
    },
    {
          "type": "image",
          "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": "/9j/4AAQSkZJRg..."
          }
    }
    ]
    is_error:false
}
```

4. 处理服务器工具调用
一般情况下，服务器工具的调用是直接由SDK内部协同自动处理响应的。不需要人为干预。当服务器处理完成响应结果后，Claude会重新生成一个消息然后响应用户原始请求。

### 三、 错误处理  
1. 如果是工具抛出的错误，比方说像网络错误，你就可以**直接将错误信息填充到content后发送给Claude。同时将is_error设置为true**，例如：  
```js
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "ConnectionError: the weather service API is not available (HTTP 500)",
      "is_error": true
    }
  ]
}
```  
Claude在收到错误信息以后，会自动处理并整合信息进入到回复用户的消息中，比方说：`不好意思，目前暂时获取不到天气的情况，因为天气API暂时无法调用`。**简单点来说，它会帮助你做消息识别并自动转达给用户，只需要将错误原文抛给Claude就行。**  
同时最好**给定一些包含指引性信息的错误在里面**，比方说：‘访问量目前达到上限，请60秒后尝试。’。这种信息可以**帮助Claude进行错误后的恢复尝试**。Claude在获取到这个指令消息以后，会60秒后重新调用一次工具  

2. 工具本身错误
如果Claude尝试调用的工具是非法的，比方说名称非法亦或者是参数非法等等情况。这个时候**Claude会根据你的工具的描述去猜测对应的调用方式或者试图填补缺失的参数**，**然后再次尝试调用你的这个非法工具**。  
**你所需要做的，仅仅就是拦截这个错误信息，并且告诉Claude到底是哪个地方有问题**。比方说：
```js
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "Error: Missing required 'location' parameter", //缺失location参数
      "is_error": true
    }
  ]
}
```  
在这个例子中，Claude看到错误信息以后，会尝试着在不填写location参数/盲填一个location参数的情况下，去再次调用你的工具。**如果重复尝试了2-3次以后还是无法成功，那么Claude会生成一个道歉信息返回给用户**。

3. 服务器工具错误：这种情况一般由Claude自身捕获并解决。不需要开发者单独处理

### 演示Demo  
见`index.js`
包含5个章节，分别是：  
1. one-turn.js：简单的一轮工具调用的对话Demo。主要用来快速上手让你了解工具调用怎么实现
2. agentic-loop.js：仅存在一个工具，多次调用的处理方法
3. multiple_tools_parallel_calls.js： 多个工具可并行调用的场景
4. handle-error.js： 工具调用中错误场景处理方法
5. tool-runner.js：讲解了Anthropic 封装的tool-runner SDK的使用方法。这个tool-runner本质上就是对于前面1-4节的内容的封装。
重点在于了解**agentic-loop，这种循环处理对话和工具调用的方式。市面上大部分大模型框架，本质上都是对这种循环和错误处理的封装**
```js
const messages = [] //聊天记录
let response = await client.messages.create({
    ...//工具调用
})
/**
 * 下面是agentic-loop的核心代码
 * 重点理解他的开启/终止条件，以及错误处理的方法（is_error)，以及回填消息的处理
 */
while(response.stop_reason === 'tool_use') {
    const tool_results = [] //因为一次response中可能存在多个tool_use调用，因此tool_results需要集中存放，到时候集中返回
    response.content.forEach(block => {
        const {type = '', id:tool_use_id = '', input = {}, name = ''};
        let result = ''
        let is_error = false //记录是否调用出错
        if(type !== 'tool_use') {
            return;
        }
        try {
            //确保这个工具函数存在
            if(typeof name !== 'function') {
                throw Error(`工具函数${name}不存在`);
            }
            result = name({
                    ...input
                })?.toString?.() //结果必须得转换为字符串
        }
        catch(err) {
            is_error = true
            result = '调用错误，错误信息： ' + err?.message
        }
        tool_results.push({
            role:'user',
            content:{
                type:'tool_result',
                content:result,
                tool_use_id,
                is_error,
            }
        })
    })
    //将模型之前的历史消息回溯推到消息记录中
    messages.push({
        role:'assistant',
        content:response.content
    })
    //将工具调用的结果回填到消息记录中
    message.push({
        role:'user',
        content:tool_results,
    })
    response = await client.messages.create({
        ...其他选项,
        messages,
    })
}   
```