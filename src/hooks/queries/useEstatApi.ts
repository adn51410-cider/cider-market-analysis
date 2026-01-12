/**
 * e-Stat API関連のTanStack Query Hooks
 *
 * ヘルスチェックとCSVインポート用のミューテーションを提供
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================
// 型定義
// ============================================================

/** ヘルスチェックレスポンス */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
    };
    memory: {
      status: 'healthy' | 'warning' | 'unhealthy';
      heapUsed: number;
      heapTotal: number;
      percentage: number;
    };
  };
}

/** CSVインポートリクエスト */
export interface CsvImportRequest {
  file: File;
  overwrite?: boolean;
}

/** CSVインポートレスポンス */
export interface CsvImportResponse {
  success: boolean;
  message: string;
  imported: number;
  skipped: number;
  errors: string[];
}

/** CSVインポートエラーレスポンス */
export interface CsvImportError {
  success: false;
  error: string;
  code?: string;
  details?: string[];
}

// ============================================================
// API関数
// ============================================================

/**
 * ヘルスチェックAPIを呼び出す
 */
async function fetchHealthCheck(): Promise<HealthCheckResponse> {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * CSVインポートAPIを呼び出す
 */
async function importCsv(request: CsvImportRequest): Promise<CsvImportResponse> {
  const formData = new FormData();
  formData.append('file', request.file);
  if (request.overwrite !== undefined) {
    formData.append('overwrite', String(request.overwrite));
  }

  const response = await fetch('/api/import/csv', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as CsvImportError;
    throw new Error(error.error || `Import failed: ${response.status}`);
  }

  return data as CsvImportResponse;
}

// ============================================================
// Hooks
// ============================================================

/**
 * ヘルスチェック用Hook
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useHealthCheck();
 *
 * if (data?.status === 'healthy') {
 *   return <StatusBadge color="green">Online</StatusBadge>;
 * }
 * ```
 */
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealthCheck,
    staleTime: 30 * 1000, // 30秒間キャッシュ
    retry: 1,
    refetchInterval: 60 * 1000, // 1分ごとに自動更新
  });
}

/**
 * CSVインポート用Mutation Hook
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useCsvImport();
 *
 * const handleFileUpload = (file: File) => {
 *   mutate(
 *     { file, overwrite: true },
 *     {
 *       onSuccess: (data) => {
 *         alert(`${data.imported}件のデータをインポートしました`);
 *       },
 *       onError: (error) => {
 *         alert(`エラー: ${error.message}`);
 *       },
 *     }
 *   );
 * };
 * ```
 */
export function useCsvImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importCsv,
    onSuccess: () => {
      // インポート成功後、市場データのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['marketData'] });
    },
  });
}

export default { useHealthCheck, useCsvImport };
