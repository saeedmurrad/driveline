import { Pipe, PipeTransform } from '@angular/core';
import { webpAt } from '../utils/stock-image';

/** Small stock photo: the 480px WebP when it exists, else the original. */
@Pipe({ name: 'thumb' })
export class ThumbPipe implements PipeTransform {
  transform(path: string | null | undefined): string {
    return webpAt(path, 480) ?? path ?? '';
  }
}
