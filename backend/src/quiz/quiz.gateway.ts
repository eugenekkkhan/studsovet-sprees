import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QuizService } from './quiz.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/quiz' })
export class QuizGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly quizService: QuizService) {}

  broadcastState() {
    this.server.emit('state:update', this.quizService.getState());
  }

  handleDisconnect(client: Socket) {
    this.quizService.unregisterCaptain(client.id);
  }

  @SubscribeMessage('get:state')
  handleGetState(@ConnectedSocket() client: Socket) {
    client.emit('state:update', this.quizService.getState());
  }

  @SubscribeMessage('captain:join')
  handleCaptainJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teamId: string },
  ) {
    const result = this.quizService.registerCaptain(client.id, data.teamId);
    client.emit('captain:joined', result);
    if (result.success) {
      client.emit('state:update', this.quizService.getState());
    }
  }

  @SubscribeMessage('captain:buzz')
  handleBuzz(@ConnectedSocket() client: Socket) {
    const teamId = this.quizService.getCaptainTeamId(client.id);
    if (!teamId) {
      client.emit('buzz:error', { error: 'Not registered as captain' });
      return;
    }
    const result = this.quizService.buzz(teamId);
    if (result.success) {
      this.broadcastState();
    } else {
      client.emit('buzz:error', result);
    }
  }
}
