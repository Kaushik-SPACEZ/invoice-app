<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\AuditLog;

class LogApiRequest
{
    /**
     * Log all mutating API requests to the audit log.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $response = $next($request);

        // Only log write operations by authenticated users
        if (
            in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])
            && auth()->check()
            && $response->getStatusCode() < 400
        ) {
            try {
                AuditLog::create([
                    'user_id'     => auth()->id(),
                    'action'      => strtolower($request->method()) . '_' . $this->routeName($request),
                    'entity_type' => $this->routeName($request),
                    'entity_id'   => $request->route('id'),
                    'new_values'  => $request->except(['password', 'token']),
                    'ip_address'  => $request->ip(),
                    'user_agent'  => $request->userAgent(),
                ]);
            } catch (\Exception $e) {
                // Never let audit logging break the actual request
            }
        }

        return $response;
    }

    private function routeName(Request $request): string
    {
        $path = trim($request->path(), '/');
        $segments = explode('/', $path);
        // e.g. "api/invoices/42" → "invoice"
        $resource = $segments[1] ?? 'unknown';
        return rtrim($resource, 's'); // rough singularize
    }
}
