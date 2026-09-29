/** Типы для site-privacy.mjs: модуль подключается и сборкой, и кабинетом (см. src/editor/preview.ts). */
export declare const POLICY_VERSION: string;
export declare function applySitePrivacy(html: string, lang: string): string;
export declare function report(): string;
export declare function assertApplied(): void;
