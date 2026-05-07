import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { QuizService } from './quiz.service';
import { QuizGateway } from './quiz.gateway';

const uploadsDir = join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ADMIN_USERNAME = 'admin';

function checkBasicAuth(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Basic '))
    throw new UnauthorizedException('Missing credentials');
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  const username = decoded.slice(0, colon);
  const password = decoded.slice(colon + 1);
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  if (username !== ADMIN_USERNAME || password !== adminPassword)
    throw new UnauthorizedException('Invalid credentials');
}

@Controller('quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizGateway: QuizGateway,
  ) {}

  @Get('state')
  getState() {
    return this.quizService.getState();
  }

  @Post('self-register-team')
  selfRegisterTeam(@Body() body: { name: string; color: string }) {
    if (!body.name?.trim()) throw new HttpException('Name required', HttpStatus.BAD_REQUEST);
    const team = this.quizService.addTeam(body.name.trim(), body.color || '#2563eb');
    this.quizGateway.broadcastState();
    return team;
  }

  @Post('admin/auth')
  checkAuth(@Headers('authorization') auth: string) {
    checkBasicAuth(auth);
    return { success: true };
  }

  @Post('admin/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        cb(null, /^(image\/|audio\/)/.test(file.mimetype));
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @Headers('authorization') auth: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    checkBasicAuth(auth);
    if (!file) throw new HttpException('No file or unsupported type', HttpStatus.BAD_REQUEST);
    const mediaType: 'image' | 'audio' = file.mimetype.startsWith('image/') ? 'image' : 'audio';
    return { url: `http://localhost:3000/uploads/${file.filename}`, mediaType };
  }

  // --- Teams ---

  @Post('admin/teams')
  addTeam(
    @Headers('authorization') auth: string,
    @Body() body: { name: string; color: string },
  ) {
    checkBasicAuth(auth);
    const team = this.quizService.addTeam(body.name, body.color);
    this.quizGateway.broadcastState();
    return team;
  }

  @Put('admin/teams/:id')
  updateTeam(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; score?: number },
  ) {
    checkBasicAuth(auth);
    const team = this.quizService.updateTeam(id, body);
    if (!team) throw new HttpException('Team not found', HttpStatus.NOT_FOUND);
    this.quizGateway.broadcastState();
    return team;
  }

  @Delete('admin/teams/:id')
  deleteTeam(@Headers('authorization') auth: string, @Param('id') id: string) {
    checkBasicAuth(auth);
    const success = this.quizService.deleteTeam(id);
    if (!success) throw new HttpException('Team not found', HttpStatus.NOT_FOUND);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  // --- Rounds ---

  @Post('admin/rounds')
  addRound(
    @Headers('authorization') auth: string,
    @Body() body: { name: string },
  ) {
    checkBasicAuth(auth);
    const round = this.quizService.addRound(body.name);
    this.quizGateway.broadcastState();
    return round;
  }

  @Put('admin/rounds/:id')
  updateRound(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    checkBasicAuth(auth);
    const round = this.quizService.updateRound(id, body.name);
    if (!round) throw new HttpException('Round not found', HttpStatus.NOT_FOUND);
    this.quizGateway.broadcastState();
    return round;
  }

  @Delete('admin/rounds/:id')
  deleteRound(@Headers('authorization') auth: string, @Param('id') id: string) {
    checkBasicAuth(auth);
    const result = this.quizService.deleteRound(id);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  // --- Categories ---

  @Post('admin/rounds/:roundId/categories')
  addCategory(
    @Headers('authorization') auth: string,
    @Param('roundId') roundId: string,
    @Body() body: { name: string },
  ) {
    checkBasicAuth(auth);
    const cat = this.quizService.addCategory(roundId, body.name);
    if (!cat) throw new HttpException('Round not found', HttpStatus.NOT_FOUND);
    this.quizGateway.broadcastState();
    return cat;
  }

  @Put('admin/categories/:id')
  updateCategory(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    checkBasicAuth(auth);
    const result = this.quizService.updateCategory(id, body.name);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return result.category;
  }

  @Delete('admin/categories/:id')
  deleteCategory(@Headers('authorization') auth: string, @Param('id') id: string) {
    checkBasicAuth(auth);
    const result = this.quizService.deleteCategory(id);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  // --- Questions ---

  @Post('admin/categories/:categoryId/questions')
  addQuestion(
    @Headers('authorization') auth: string,
    @Param('categoryId') categoryId: string,
    @Body() body: { text: string; answer: string; points: number; mediaUrl?: string; mediaType?: 'image' | 'audio'; answerMediaUrl?: string; answerMediaType?: 'image' | 'audio' },
  ) {
    checkBasicAuth(auth);
    const question = this.quizService.addQuestion(
      categoryId,
      body.text,
      body.answer,
      body.points,
      body.mediaUrl,
      body.mediaType,
      body.answerMediaUrl,
      body.answerMediaType,
    );
    if (!question) throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    this.quizGateway.broadcastState();
    return question;
  }

  @Put('admin/questions/:id')
  updateQuestion(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: { text?: string; answer?: string; points?: number; mediaUrl?: string | null; mediaType?: 'image' | 'audio' | null; answerMediaUrl?: string | null; answerMediaType?: 'image' | 'audio' | null },
  ) {
    checkBasicAuth(auth);
    const result = this.quizService.updateQuestion(id, body);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return result.question;
  }

  @Delete('admin/questions/:id')
  deleteQuestion(@Headers('authorization') auth: string, @Param('id') id: string) {
    checkBasicAuth(auth);
    const result = this.quizService.deleteQuestion(id);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  // --- Game control ---

  @Post('admin/game/start-round')
  startRound(
    @Headers('authorization') auth: string,
    @Body() body: { roundId: string },
  ) {
    checkBasicAuth(auth);
    const result = this.quizService.startRound(body.roundId);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  @Post('admin/game/open-question')
  openQuestion(
    @Headers('authorization') auth: string,
    @Body() body: { questionId: string },
  ) {
    checkBasicAuth(auth);
    const result = this.quizService.openQuestion(body.questionId);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  @Post('admin/game/judge')
  judgeAnswer(
    @Headers('authorization') auth: string,
    @Body() body: { correct: boolean },
  ) {
    checkBasicAuth(auth);
    const result = this.quizService.judgeAnswer(body.correct);
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  @Post('admin/game/skip')
  skipQuestion(@Headers('authorization') auth: string) {
    checkBasicAuth(auth);
    const result = this.quizService.skipQuestion();
    if (!result.success)
      throw new HttpException(result.error ?? 'Error', HttpStatus.BAD_REQUEST);
    this.quizGateway.broadcastState();
    return { success: true };
  }

  @Post('admin/game/end-round')
  endRound(@Headers('authorization') auth: string) {
    checkBasicAuth(auth);
    this.quizService.endRound();
    this.quizGateway.broadcastState();
    return { success: true };
  }
}
