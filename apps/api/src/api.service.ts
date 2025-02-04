import {Injectable, Logger} from "@nestjs/common";

@Injectable()
export class ApiService {
    private readonly logger = new Logger(ApiService.name);
}
