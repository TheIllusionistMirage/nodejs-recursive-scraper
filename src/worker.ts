import workerpool from 'workerpool';
import { Logger } from "tslog";

const log: Logger = new Logger();

const fibonacci = (n: number): number => {
    if (n < 2) return n;
    return fibonacci2(n - 2) + fibonacci2(n - 1);
}

const fibonacci2 = (n: number): number => {
    if (n < 2) return n;
    return fibonacci2(n - 2) + fibonacci2(n - 1);
}

const bigTask2 = (n: number): number => {
    let sum = 0;
    for (let i = 0; i < n; ++i) {
        sum += i*i;
        for (let j = 0; j < n; ++j) {
            sum += j*j;
        }
    }
    log.info('Sum:', sum);
    return sum;
}

workerpool.worker({
    fibonacci,
    bigTask2
});