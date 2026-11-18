"""Synthetic isolated Git fixtures, not claims about live source rights."""
import copy
from pathlib import Path
import subprocess
import tempfile
import unittest

from scripts.catalog_handoff import sha256, git_blob, COMMIT, TREE
from scripts.verify_catalog_source import verify_source_tree, Refusal


def run(cwd, *cmd):
    p = subprocess.run(['git', '-C', str(cwd), *cmd], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return p.stdout.decode().strip()


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)/'source'
        self.repo.mkdir()
        run(self.repo,'init','-q')
        run(self.repo,'config','user.email','fixture@example.test')
        run(self.repo,'config','user.name','Fixture')
        (self.repo/'doc').mkdir()
        (self.repo/'doc'/'source.txt').write_bytes(b'no rights implied\n')
        (self.repo/'binary.dat').write_bytes(b'\0A\xff\n')
        run(self.repo,'add','.')
        run(self.repo,'commit','-qm','initial')
        self.commit=run(self.repo,'rev-parse','HEAD')
        self.tree=run(self.repo,'rev-parse','HEAD^{tree}')
        files=[]
        for name in ('doc/source.txt','binary.dat'):
            blob=(self.repo/name).read_bytes()
            files.append({'path':name,'bytes':len(blob),'git_blob_sha1':git_blob(blob),'sha256':sha256(blob)})
        self.manifest={'source':{'repository':'https://github.com/Knapp-Kevin/skillz',
                        'commit':self.commit,'git_tree_sha1':self.tree},
                       'source_files':files,'submodule_pins':[]}

    def tearDown(self):
        self.temp.cleanup()

    def verify(self, manifest=None):
        return verify_source_tree(self.repo, manifest or self.manifest,
                                  expected_commit=self.commit, expected_tree=self.tree)

    def test_full_git_tree_bytes_and_sha256(self):
        got=self.verify()
        self.assertEqual((got['file_sha256_verified'],got['gitlinks_verified']),(2,0))
        self.assertFalse(got['composition_eligible'])
        self.assertFalse(got['source_rights_assessed'])

    def test_source_byte_tamper_is_refused(self):
        (self.repo/'binary.dat').write_bytes(b'\0B\xff\n')
        with self.assertRaises(Refusal) as e:self.verify()
        self.assertEqual(e.exception.code,'SOURCE_BLOB')

    def test_declared_sha256_tamper_is_refused(self):
        m=copy.deepcopy(self.manifest)
        m['source_files'][1]['sha256']='0'*64
        with self.assertRaises(Refusal) as e:self.verify(m)
        self.assertEqual(e.exception.code,'SOURCE_SHA256')

    def test_extra_or_missing_tracked_input_refuses(self):
        m=copy.deepcopy(self.manifest)
        m['source_files'].pop()
        with self.assertRaises(Refusal) as e:self.verify(m)
        self.assertEqual(e.exception.code,'SOURCE_INVENTORY')

    def test_symlinked_file_refuses_even_if_git_pin_matches(self):
        target=Path(self.temp.name)/'outside.txt'
        target.write_bytes(b'no rights implied\n')
        (self.repo/'doc'/'source.txt').unlink()
        (self.repo/'doc'/'source.txt').symlink_to(target)
        with self.assertRaises(Refusal) as e:self.verify()
        self.assertEqual(e.exception.code,'SOURCE_SYMLINK')

    def test_symlinked_parent_refuses(self):
        source=(self.repo/'doc'/'source.txt').read_bytes()
        (self.repo/'doc'/'source.txt').unlink()
        (self.repo/'doc').rmdir()
        outside=Path(self.temp.name)/'outside'
        outside.mkdir();(outside/'source.txt').write_bytes(source)
        (self.repo/'doc').symlink_to(outside,target_is_directory=True)
        with self.assertRaises(Refusal) as e:self.verify()
        self.assertEqual(e.exception.code,'SOURCE_SYMLINK')

    def test_stale_git_head_refuses(self):
        (self.repo/'extra').write_bytes(b'new\n')
        run(self.repo,'add','.');run(self.repo,'commit','-qm','mutate')
        with self.assertRaises(Refusal) as e:self.verify()
        self.assertEqual(e.exception.code,'SOURCE_PIN')

    def test_manifest_tree_mismatch_refuses(self):
        m=copy.deepcopy(self.manifest)
        m['source']['git_tree_sha1']='0'*40
        with self.assertRaises(Refusal) as e:self.verify(m)
        self.assertEqual(e.exception.code,'SOURCE_PIN')

    def test_path_traversal_refuses(self):
        m=copy.deepcopy(self.manifest)
        m['source_files'][0]['path']='../outside.txt'
        with self.assertRaises(Refusal) as e:self.verify(m)
        self.assertEqual(e.exception.code,'SOURCE_PATH')

    def test_duplicate_path_refuses(self):
        m=copy.deepcopy(self.manifest)
        m['source_files'].append(m['source_files'][0])
        with self.assertRaises(Refusal) as e:self.verify(m)
        self.assertEqual(e.exception.code,'SOURCE_DECLARATION')

    def test_unexpected_gitlink_refuses(self):
        m=copy.deepcopy(self.manifest)
        m['submodule_pins']=[{'path':'bad','pinned_commit':'a'*40}]
        with self.assertRaises(Refusal) as e:self.verify(m)
        self.assertEqual(e.exception.code,'SOURCE_INVENTORY')

    def test_no_production_pin_override_in_cli(self):
        self.assertNotEqual(self.commit,COMMIT)
        self.assertNotEqual(self.tree,TREE)


if __name__=='__main__':unittest.main()
