const FIELD_PATTERNS = [
  {
    field: 'product.name',
    pattern: /product.?name|tool.?name|app.?name|title|name|项目名称|产品名称|工具名称/i,
  },
  {
    field: 'product.url',
    pattern: /website|homepage|product.?url|tool.?url|app.?url|url|link|site|官网|网站|链接/i,
  },
  {
    field: 'product.email',
    pattern: /email|e-mail|mail|contact|邮箱|邮件/i,
  },
  {
    field: 'product.description',
    pattern: /description|summary|about|details|intro|介绍|简介|描述/i,
  },
  {
    field: 'product.category',
    pattern: /category|type|industry|分类|类别/i,
  },
  {
    field: 'product.tags',
    pattern: /tag|keyword|topic|标签|关键词/i,
  },
  {
    field: 'product.pricing',
    pattern: /pricing|price|free|paid|plan|价格|定价|收费/i,
  },
  {
    field: 'product.logo',
    pattern: /logo|icon|avatar|image|图标|标志/i,
  },
  {
    field: 'product.screenshot',
    pattern: /screenshot|gallery|image|preview|截图|预览/i,
  },
  {
    field: 'product.video_url',
    pattern: /video|youtube|loom|demo|演示|视频/i,
  },
];

function labelText(field = {}) {
  return [
    field.label,
    field.name,
    field.id,
    field.placeholder,
    field.aria_label,
    field.type,
  ].filter(Boolean).join(' ');
}

export function mapField(field = {}) {
  const text = labelText(field);
  for (const entry of FIELD_PATTERNS) {
    if (entry.pattern.test(text)) return entry.field;
  }
  return '';
}

export function mapFormFields(forms = []) {
  return forms.map(form => ({
    ...form,
    fields: (form.fields || []).map(field => ({
      ...field,
      mapped_to: field.mapped_to || mapField(field),
    })),
  }));
}
