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

const NON_PRODUCT_FIELD_RE = /recipr|recpr|reciprocal|back[-_\s]?link|link[-_\s]?back|return[-_\s]?link|交换链接|反向链接|友情链接/i;

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
  if (NON_PRODUCT_FIELD_RE.test(text)) return '';
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

export function productValueForField(product = {}, mappedField = '') {
  switch (mappedField) {
    case 'product.name':
      return product.name || '';
    case 'product.url':
      return product.utm_url || product.url || '';
    case 'product.email':
      return product.email || '';
    case 'product.description':
      return product.long_description || product.description || '';
    case 'product.category':
      return Array.isArray(product.categories) ? product.categories[0] || '' : product.category || '';
    case 'product.tags':
      return Array.isArray(product.features)
        ? product.features.join(', ')
        : Array.isArray(product.tags)
          ? product.tags.join(', ')
          : product.tags || '';
    case 'product.pricing':
      return product.pricing || '';
    case 'product.logo':
      return product.logo_url || '';
    case 'product.video_url':
      return product.video_url || '';
    default:
      return '';
  }
}
