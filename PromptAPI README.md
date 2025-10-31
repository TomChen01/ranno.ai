Prompt API

bookmark_border

content_copy


Thomas Steiner
Thomas Steiner
Alexandra Klepper
Alexandra Klepper

发布时间：2025 年 5 月 20 日，上次更新时间：2025 年 9 月 21 日

说明类视频	Web	扩展程序	Chrome 状态	目的
GitHub	源试用 源试用	 Chrome 138	视图	实验意图
借助 Prompt API，您可以在浏览器中向 Gemini Nano 发送自然语言请求。

您可以通过多种方式使用 Prompt API。例如，您可以构建：

AI 赋能的搜索：根据网页内容回答问题。
个性化新闻 Feed：构建一个可动态对文章进行分类的 Feed，并允许用户过滤相应内容。
自定义内容过滤器。分析新闻报道，并根据用户定义的主题自动模糊处理或隐藏内容。
日历活动创建。开发一款可自动从网页中提取活动详情的 Chrome 扩展程序，以便用户只需几个步骤即可创建日历条目。
无缝提取联系人信息。构建一个可从网站提取联系信息的扩展程序，让用户更轻松地联系商家或向其联系人列表添加详细信息。
以上只是几个可能的示例，我们期待看到您的创作成果。

重要提示：Gemini Nano 是一种生成式 AI 模型。在使用 Gemini Nano API 进行构建之前，您应查看人与 AI 指南，了解 AI 辅助设计方面的最佳实践、方法和示例。
查看硬件要求
开发者和在 Chrome 中使用这些 API 运行功能的用户必须满足以下要求。其他浏览器可能有不同的运行要求。

Language Detector API 和 Translator API 可在桌面版 Chrome 中使用。这些 API 不适用于移动设备。当满足以下条件时，Prompt API、Summarizer API、Writer API、Rewriter API 和 Proofreader API 可在 Chrome 中运行：

操作系统：Windows 10 或 11；macOS 13 及更高版本（Ventura 及更高版本）； Linux；或 ChromeOS（从平台 16389.0.0 及更高版本开始）在 Chromebook Plus 设备上运行。 非 Chromebook Plus 设备上的 Android 版 Chrome、iOS 版 Chrome 和 ChromeOS 版 Chrome 尚不支持使用 Gemini Nano 的 API。
存储空间：包含 Chrome 个人资料的卷上至少有 22 GB 的可用空间。
内置模型应明显更小。确切大小可能会因更新而略有不同。
GPU 或 CPU：内置模型可以使用 GPU 或 CPU 运行。
GPU：VRAM 严格大于 4 GB。
CPU：16 GB 或更多 RAM 和 4 个或更多 CPU 核心。
网络：无限流量或不按流量计费的网络连接。
关键术语：按流量计费的连接是指流量有限的互联网连接。Wi-Fi 和以太网连接默认情况下往往不按流量计费，而移动网络连接通常按流量计费。
随着浏览器更新模型，Gemini Nano 的确切大小可能会有所不同。如需确定当前大小，请访问 chrome://on-device-internals。

注意：如果下载后可用存储空间降至 10 GB 以下，系统会从您的设备中移除该模型。满足要求后，模型会重新下载。
使用 Prompt API
Prompt API 使用 Chrome 中的 Gemini Nano 模型。虽然该 API 内置于 Chrome 中，但模型会在来源首次使用该 API 时单独下载。在使用此 API 之前，请确认您已了解《Google 生成式 AI 使用限制政策》。

注意： 扩展程序开发者应移除已过期的源试用权限："permissions": ["aiLanguageModelOriginTrial"]。
如需确定模型是否已准备就绪，请调用 LanguageModel.availability()。


const availability = await LanguageModel.availability();
注意： 请始终将您在 prompt() 或 promptStreaming() 中使用的相同选项传递给 availability() 函数。这一点至关重要，因为某些模型可能不支持特定模态或语言。
在下载模型之前，必须有用户互动（例如点击、点按或按键）。

如果响应为 downloadable 或 downloading，则表示模型和 API 可用，但必须先下载，然后才能使用相应功能。用户必须与网页互动（例如点击、点按或按键），才能允许下载。

如需下载并实例化模型，请调用 create() 函数。


const session = await LanguageModel.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  },
});
如果对 availability() 的响应为 downloading，请监听下载进度并告知用户，因为下载可能需要一些时间。

模型参数
params() 函数会告知您语言模型的参数。该对象具有以下字段：

defaultTopK：默认的 top-K 值。
maxTopK：最大 Top-K 值。
defaultTemperature：默认温度。
maxTemperature：最高温度。

await LanguageModel.params();
// {defaultTopK: 3, maxTopK: 128, defaultTemperature: 1, maxTemperature: 2}
创建会话
Prompt API 可以运行后，您可以使用 create() 函数创建会话。

您可以使用可选的 options 对象，通过 topK 和 temperature 自定义每个会话。这些形参的默认值是从 LanguageModel.params() 返回的。


const params = await LanguageModel.params();
// Initializing a new session must either specify both `topK` and
// `temperature` or neither of them.
const slightlyHighTemperatureSession = await LanguageModel.create({
  temperature: Math.max(params.defaultTemperature * 1.2, 2.0),
  topK: params.defaultTopK,
});
create() 函数的可选选项对象还包含一个 signal 字段，可用于传递 AbortSignal 以销毁会话。


const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const session = await LanguageModel.create({
  signal: controller.signal,
});
通过初始提示添加上下文
借助初始提示，您可以为语言模型提供有关之前互动的上下文，例如，允许用户在浏览器重启后继续之前存储的会话。


const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a helpful and friendly assistant.' },
    { role: 'user', content: 'What is the capital of Italy?' },
    { role: 'assistant', content: 'The capital of Italy is Rome.' },
    { role: 'user', content: 'What language is spoken there?' },
    {
      role: 'assistant',
      content: 'The official language of Italy is Italian. [...]',
    },
  ],
});
使用前缀限制回答
除了之前的角色之外，您还可以添加 "assistant" 角色，以详细说明模型之前的回答。例如：


const followup = await session.prompt([
  {
    role: "user",
    content: "I'm nervous about my presentation tomorrow"
  },
  {
    role: "assistant",
    content: "Presentations are tough!"
  }
]);
在某些情况下，您可能希望预先填充部分 "assistant" 角色响应消息，而不是请求新的响应。这有助于引导语言模型使用特定的回答格式。为此，请将 prefix: true 添加到尾随的 "assistant" 角色消息中。例如：


const characterSheet = await session.prompt([
  {
    role: 'user',
    content: 'Create a TOML character sheet for a gnome barbarian',
  },
  {
    role: 'assistant',
    content: '```toml\n',
    prefix: true,
  },
]);
添加预期输入和输出
Prompt API 具有多模态功能，并支持多种语言。创建会话时，设置 expectedInputs 和 expectedOutputs 模态和语言。

type：预期模态。
对于 expectedInputs，此值可以是 text、image 或 audio。
对于 expectedOutputs，提示 API 仅允许 text。
languages：用于设置预期语言的数组。Prompt API 接受 "en"、"ja" 和 "es"。我们正在开发对其他语言的支持。
对于 expectedInputs，请设置系统提示语言以及一种或多种预期用户提示语言。
设置一种或多种 expectedOutputs 语言。

const session = await LanguageModel.create({
  expectedInputs: [
    { type: "text", languages: ["en" /* system prompt */, "ja" /* user prompt */] }
  ],
  expectedOutputs: [
    { type: "text", languages: ["ja"] }
  ]
});
如果模型遇到不受支持的输入或输出，您可能会收到 "NotSupportedError" DOMException。

多模态功能
注意： 多模态功能目前在 Prompt API 源试用阶段，适用于 Web 和 Chrome 扩展程序。这些功能尚未在 Chrome 稳定版中推出。
借助这些功能，您可以：

允许用户转写在聊天应用中发送的音频消息。
描述上传到您网站上的图片，以便在图片说明或替代文字中使用。
如需了解如何将 Prompt API 与音频输入搭配使用，请查看 Mediarecorder 音频提示演示；如需了解如何将 Prompt API 与图片输入搭配使用，请查看 Canvas 图片提示演示。

附加消息
推理可能需要一些时间，尤其是当提示包含多模态输入时。 预先发送预定的提示来填充会话可能很有用，这样模型就可以提前开始处理。

虽然 initialPrompts 在会话创建时很有用，但除了 prompt() 或 promptStreaming() 方法之外，还可以使用 append() 方法在会话创建后提供额外的上下文提示。

例如：


const session = await LanguageModel.create({
  initialPrompts: [
    {
      role: 'system',
      content:
        'You are a skilled analyst who correlates patterns across multiple images.',
    },
  ],
  expectedInputs: [{ type: 'image' }],
});

fileUpload.onchange = async () => {
  await session.append([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          value: `Here's one image. Notes: ${fileNotesInput.value}`,
        },
        { type: 'image', value: fileUpload.files[0] },
      ],
    },
  ]);
};

analyzeButton.onclick = async (e) => {
  analysisResult.textContent = await session.prompt(userQuestionInput.value);
};
当提示已验证、处理并附加到会话后，append() 返回的 promise 会实现。如果无法附加提示，则拒绝相应 promise。

传递 JSON 架构
向 prompt() 或 promptStreaming() 方法添加 responseConstraint 字段，以传递 JSON 架构作为值。然后，您可以将结构化输出与 Prompt API 搭配使用。

在以下示例中，JSON 架构可确保模型使用 true 或 false 来对给定消息是否与陶艺相关进行分类。


const session = await LanguageModel.create();

const schema = {
  "type": "boolean"
};

const post = "Mugs and ramen bowls, both a bit smaller than intended, but that
happens with reclaim. Glaze crawled the first time around, but pretty happy
with it after refiring.";

const result = await session.prompt(
  `Is this post about pottery?\n\n${post}`,
  {
    responseConstraint: schema,
  }
);
console.log(JSON.parse(result));
// true
您的实现可以包含 JSON 架构或正则表达式，作为发送给模型的消息的一部分。这会使用部分输入配额。您可以将 responseConstraint 选项传递给 session.measureInputUsage()，以衡量它将使用多少输入配额。

您可以使用 omitResponseConstraintInput 选项避免此行为。如果您这样做，建议您在提示中添加一些指导：


const result = await session.prompt(`
  Summarize this feedback into a rating between 0-5. Only output a JSON
  object { rating }, with a single property whose value is a number:
  The food was delicious, service was excellent, will recommend.
`, { responseConstraint: schema, omitResponseConstraintInput: true });
向模型发出提示
您可以使用 prompt() 或 promptStreaming() 函数提示模型。

非流式输出
如果您希望获得简短的结果，可以使用 prompt() 函数，该函数会在获得回答后立即返回回答。


// Start by checking if it's possible to create a session based on the
// availability of the model, and the characteristics of the device.
const { defaultTemperature, maxTemperature, defaultTopK, maxTopK } =
  await LanguageModel.params();

const available = await LanguageModel.availability();

if (available !== 'unavailable') {
  const session = await LanguageModel.create();

  // Prompt the model and wait for the whole result to come back.
  const result = await session.prompt('Write me a poem!');
  console.log(result);
}
流式输出
如果您预计响应时间较长，则应使用 promptStreaming() 函数，该函数可让您在模型返回部分结果时显示这些结果。promptStreaming() 函数会返回一个 ReadableStream。


const { defaultTemperature, maxTemperature, defaultTopK, maxTopK } =
  await LanguageModel.params();

const available = await LanguageModel.availability();
if (available !== 'unavailable') {
  const session = await LanguageModel.create();

  // Prompt the model and stream the result:
  const stream = session.promptStreaming('Write me an extra-long poem!');
  for await (const chunk of stream) {
    console.log(chunk);
  }
}
停止提示
prompt() 和 promptStreaming() 都接受带有 signal 字段的可选第二个参数，该参数可让您停止运行提示。


const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const result = await session.prompt('Write me a poem!', {
  signal: controller.signal,
});
会话管理
每个会话都会跟踪对话的上下文。在会话的上下文窗口已满之前，系统会在未来的互动中考虑之前的互动。

每个会话可处理的令牌数量上限。您可以通过以下方式查看自己距离此限制还差多少：


console.log(`${session.inputUsage}/${session.inputQuota}`);
详细了解会话管理。

克隆会话
如需保留资源，您可以使用 clone() 函数克隆现有会话。对话上下文会重置，但初始提示会保持不变。clone() 函数接受一个包含 signal 字段的可选 options 对象，该字段可让您传递 AbortSignal 来销毁克隆的会话。


const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const clonedSession = await session.clone({
  signal: controller.signal,
});
终止会话
如果您不再需要会话，请调用 destroy() 以释放资源。当会话被销毁时，它将无法再使用，并且任何正在进行的执行都会中止。如果您打算经常提示模型，可能需要保持会话处于活动状态，因为创建会话可能需要一些时间。


await session.prompt(
  "You are a friendly, helpful assistant specialized in clothing choices."
);

session.destroy();

// The promise is rejected with an error explaining that
// the session is destroyed.
await session.prompt(
  "What should I wear today? It is sunny, and I am choosing between a t-shirt
  and a polo."
);
演示
我们构建了多个演示，以探索 Prompt API 的众多应用场景。 以下演示是 Web 应用：

提示 API 游乐场
Mediarecorder 音频提示
画布图片提示
如需在 Chrome 扩展程序中测试 Prompt API，请安装演示扩展程序。扩展程序源代码可在 GitHub 上获取。

效果策略
适用于 Web 的 Prompt API 仍在开发中。在构建此 API 的同时，请参阅我们有关会话管理的最佳实践，以获得最佳性能。

权限政策、iframe 和 Web Worker
默认情况下，Prompt API 仅适用于顶级窗口及其同源 iframe。可以使用权限政策 allow="" 属性将 API 访问权限委托给跨源 iframe：


<!--
  The hosting site at https://main.example.com can grant a cross-origin iframe
  at https://cross-origin.example.com/ access to the Prompt API by
  setting the `allow="language-model"` attribute.
-->
<iframe src="https://cross-origin.example.com/" allow="language-model"></iframe>
由于需要为每个 worker 建立负责任的文档以检查权限政策状态，因此 Prompt API 目前在 Web Worker 中不可用。