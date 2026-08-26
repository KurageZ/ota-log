import { transformFileSync } from '@babel/core';

describe('ChekiPhotoWidget compilation', () => {
  test('does not leave project-local helper calls inside the serialized widget function', () => {
    const result = transformFileSync(`${process.cwd()}/src/widgets/ChekiPhotoWidget.tsx`, {
      envName: 'development',
      caller: {
        name: 'metro',
      },
    });
    const widgetFunction = result?.code?.match(/ChekiPhotoWidgetView\s*=\s*`([^`]*)`/)?.[1];

    expect(widgetFunction).toBeDefined();
    expect(widgetFunction).not.toContain('getChekiPhotoWidgetImageLayout');
  });
});
