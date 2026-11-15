import { readFileSync } from 'fs';
import { TeachersService } from '../teachers/teachers.service';
import { AppException } from '../common/errors/app.exception';
import { runCli } from './cli-app';

const USAGE = `Teacher provisioning (the only way to create teacher accounts)

  npm run teacher -- add "Full Name" ["Another Name" ...]
  npm run teacher -- add --file teachers.txt        (one full name per line)
  npm run teacher -- list
  npm run teacher -- deactivate "Full Name"
  npm run teacher -- activate "Full Name"`;

runCli(async (app) => {
  const [cmd, ...rest] = process.argv.slice(2);
  const teachers = app.get(TeachersService);

  switch (cmd) {
    case 'add': {
      let names = rest;
      if (rest[0] === '--file') {
        names = readFileSync(rest[1], 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      }
      if (!names.length) {
        console.error(USAGE);
        return 1;
      }
      let failures = 0;
      for (const n of names) {
        try {
          const t = await teachers.provision(n);
          console.log(`✓ registered: ${t.fullName}`);
        } catch (err) {
          failures++;
          console.error(`✗ ${n}: ${err instanceof AppException ? err.message : (err as Error).message}`);
        }
      }
      return failures ? 2 : 0;
    }
    case 'list': {
      const all = await teachers.list();
      if (!all.length) console.log('No teachers registered yet. Add one with: npm run teacher -- add "Full Name"');
      for (const t of all) console.log(`${t.isActive ? 'active  ' : 'inactive'}  ${t.fullName}`);
      return 0;
    }
    case 'deactivate':
    case 'activate': {
      if (!rest[0]) {
        console.error(USAGE);
        return 1;
      }
      const t = await teachers.setActive(rest.join(' '), cmd === 'activate');
      console.log(`${t.fullName} is now ${t.isActive ? 'active' : 'inactive'}.`);
      return 0;
    }
    default:
      console.log(USAGE);
      return cmd ? 1 : 0;
  }
});
