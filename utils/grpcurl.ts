import { execCommand } from "./process";

export async function runGrpcurl(opts: {
    endpoint: string
    args: string | string[];
    tls?: boolean;
    stdin?: string;
}) {
    // TODO: remove endpoint normalizing from other places
    // const endpoint = opts.endpoint.includes(':')
    //     ? opts.endpoint
    //     : (opts.tls === true ? `${opts.endpoint}:443` : `${opts.endpoint}:9090`);
    const endpoint = opts.endpoint;

    const args = [
        'grpcurl',
        !opts.tls && '-plaintext',
        ...(opts.stdin ? ['-d', '@'] : []),
        endpoint,
        ...(typeof opts.args === 'string' ? [opts.args] : opts.args),
    ].filter((v) => typeof v === 'string');

    return await execCommand(args, {
        stdin: opts?.stdin,
    });
}
